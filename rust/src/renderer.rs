use crate::scene::{Mesh, Vertex, LIGHTS};
use bytemuck::{Pod, Zeroable};
use glam::{Mat4, Vec3};
use wgpu::util::DeviceExt;
#[repr(C)]
#[derive(Clone, Copy, Pod, Zeroable)]
struct Globals {
    vp: [[f32; 4]; 4],
    light_vp: [[f32; 4]; 4],
    inverse_vp: [[f32; 4]; 4],
    eye: [f32; 4],
    lights: [[f32; 4]; 48],
    light_colors: [[f32; 4]; 48],
    screen: [f32; 4],
}
pub struct Renderer {
    device: wgpu::Device,
    queue: wgpu::Queue,
    surface: wgpu::Surface<'static>,
    config: wgpu::SurfaceConfiguration,
    uniform: wgpu::Buffer,
    group: wgpu::BindGroup,
    world_layout: wgpu::BindGroupLayout,
    shadow_sampler: wgpu::Sampler,
    pub lights: [[f32; 4]; 48],
    pub light_colors: [[f32; 4]; 48],
    shadow_group: wgpu::BindGroup,
    world: wgpu::RenderPipeline,
    shadow: wgpu::RenderPipeline,
    sky: wgpu::RenderPipeline,
    post: wgpu::RenderPipeline,
    post_layout: wgpu::BindGroupLayout,
    post_group: wgpu::BindGroup,
    depth: wgpu::TextureView,
    hdr: wgpu::TextureView,
    shadow_view: wgpu::TextureView,
    static_buf: wgpu::Buffer,
    static_count: u32,
    dynamic_buf: wgpu::Buffer,
    pub triangles: u32,
}
const VERTEX_ATTRIBUTES: [wgpu::VertexAttribute; 5] =
    wgpu::vertex_attr_array![0=>Float32x3,1=>Float32x3,2=>Float32x3,3=>Float32,4=>Float32x2];
fn vertex_layout() -> wgpu::VertexBufferLayout<'static> {
    wgpu::VertexBufferLayout {
        array_stride: std::mem::size_of::<Vertex>() as u64,
        step_mode: wgpu::VertexStepMode::Vertex,
        attributes: &VERTEX_ATTRIBUTES,
    }
}
fn texture(
    device: &wgpu::Device,
    w: u32,
    h: u32,
    format: wgpu::TextureFormat,
) -> wgpu::TextureView {
    device
        .create_texture(&wgpu::TextureDescriptor {
            label: Some("frame target"),
            size: wgpu::Extent3d {
                width: w,
                height: h,
                depth_or_array_layers: 1,
            },
            mip_level_count: 1,
            sample_count: 1,
            dimension: wgpu::TextureDimension::D2,
            format,
            usage: wgpu::TextureUsages::RENDER_ATTACHMENT | wgpu::TextureUsages::TEXTURE_BINDING,
            view_formats: &[],
        })
        .create_view(&Default::default())
}
impl Renderer {
    pub async fn new(canvas: web_sys::HtmlCanvasElement) -> Result<Self, String> {
        let instance = wgpu::Instance::new(&wgpu::InstanceDescriptor {
            backends: wgpu::Backends::BROWSER_WEBGPU,
            ..Default::default()
        });
        let surface = instance
            .create_surface(wgpu::SurfaceTarget::Canvas(canvas))
            .map_err(|e| e.to_string())?;
        let adapter = instance
            .request_adapter(&wgpu::RequestAdapterOptions {
                power_preference: wgpu::PowerPreference::HighPerformance,
                compatible_surface: Some(&surface),
                force_fallback_adapter: false,
            })
            .await
            .ok_or("No WebGPU adapter available")?;
        let (device, queue) = adapter
            .request_device(
                &wgpu::DeviceDescriptor {
                    label: Some("Veil Rust WebGPU"),
                    required_features: wgpu::Features::empty(),
                    required_limits: wgpu::Limits::default(),
                    memory_hints: Default::default(),
                },
                None,
            )
            .await
            .map_err(|e| e.to_string())?;
        device.on_uncaptured_error(Box::new(|error| {
            web_sys::console::error_1(&wasm_bindgen::JsValue::from_str(&format!(
                "WebGPU validation: {error}"
            )));
        }));
        device.push_error_scope(wgpu::ErrorFilter::Validation);
        let caps = surface.get_capabilities(&adapter);
        let format = caps
            .formats
            .iter()
            .copied()
            .find(|f| !f.is_srgb())
            .unwrap_or(caps.formats[0]);
        let config = wgpu::SurfaceConfiguration {
            usage: wgpu::TextureUsages::RENDER_ATTACHMENT,
            format,
            width: 1280,
            height: 720,
            present_mode: wgpu::PresentMode::Fifo,
            desired_maximum_frame_latency: 2,
            alpha_mode: caps.alpha_modes[0],
            view_formats: vec![],
        };
        surface.configure(&device, &config);
        let uniform = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("scene uniforms"),
            size: std::mem::size_of::<Globals>() as u64,
            usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });
        let layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("world lighting"),
            entries: &[
                wgpu::BindGroupLayoutEntry {
                    binding: 0,
                    visibility: wgpu::ShaderStages::VERTEX_FRAGMENT,
                    ty: wgpu::BindingType::Buffer {
                        ty: wgpu::BufferBindingType::Uniform,
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                },
                wgpu::BindGroupLayoutEntry {
                    binding: 1,
                    visibility: wgpu::ShaderStages::FRAGMENT,
                    ty: wgpu::BindingType::Texture {
                        sample_type: wgpu::TextureSampleType::Depth,
                        view_dimension: wgpu::TextureViewDimension::D2,
                        multisampled: false,
                    },
                    count: None,
                },
                wgpu::BindGroupLayoutEntry {
                    binding: 2,
                    visibility: wgpu::ShaderStages::FRAGMENT,
                    ty: wgpu::BindingType::Sampler(wgpu::SamplerBindingType::Comparison),
                    count: None,
                },
                wgpu::BindGroupLayoutEntry {
                    binding: 3,
                    visibility: wgpu::ShaderStages::FRAGMENT,
                    ty: wgpu::BindingType::Texture {
                        sample_type: wgpu::TextureSampleType::Float { filterable: true },
                        view_dimension: wgpu::TextureViewDimension::D2,
                        multisampled: false,
                    },
                    count: None,
                },
                wgpu::BindGroupLayoutEntry {
                    binding: 4,
                    visibility: wgpu::ShaderStages::FRAGMENT,
                    ty: wgpu::BindingType::Sampler(wgpu::SamplerBindingType::Filtering),
                    count: None,
                },
            ],
        });
        let shadow_view = texture(&device, 2048, 2048, wgpu::TextureFormat::Depth32Float);
        let sampler = device.create_sampler(&wgpu::SamplerDescriptor {
            compare: Some(wgpu::CompareFunction::LessEqual),
            mag_filter: wgpu::FilterMode::Linear,
            min_filter: wgpu::FilterMode::Linear,
            ..Default::default()
        });
        let atlas = Self::atlas(&device, &queue, &[255, 255, 255, 255], 1, 1);
        let group = Self::world_group(&device, &layout, &uniform, &shadow_view, &sampler, &atlas);
        let placeholder = texture(&device, 1, 1, wgpu::TextureFormat::Depth32Float);
        let shadow_group =
            Self::world_group(&device, &layout, &uniform, &placeholder, &sampler, &atlas);
        let pipe_layout = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
            label: None,
            bind_group_layouts: &[&layout],
            push_constant_ranges: &[],
        });
        let shader = device.create_shader_module(wgpu::include_wgsl!("world.wgsl"));
        let mesh_layouts = [vertex_layout()];
        let pipeline =
            |label: &str, vs: &str, fs: Option<&str>, buffers: bool, depth_write: bool| {
                device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
                    label: Some(label),
                    layout: Some(&pipe_layout),
                    vertex: wgpu::VertexState {
                        module: &shader,
                        entry_point: Some(vs),
                        buffers: if buffers { &mesh_layouts } else { &[] },
                        compilation_options: Default::default(),
                    },
                    fragment: fs.map(|name| wgpu::FragmentState {
                        module: &shader,
                        entry_point: Some(name),
                        targets: &[Some(wgpu::ColorTargetState {
                            format: wgpu::TextureFormat::Rgba16Float,
                            blend: None,
                            write_mask: wgpu::ColorWrites::ALL,
                        })],
                        compilation_options: Default::default(),
                    }),
                    primitive: wgpu::PrimitiveState {
                        cull_mode: None,
                        ..Default::default()
                    },
                    depth_stencil: Some(wgpu::DepthStencilState {
                        format: wgpu::TextureFormat::Depth32Float,
                        depth_write_enabled: depth_write,
                        depth_compare: wgpu::CompareFunction::LessEqual,
                        stencil: Default::default(),
                        bias: Default::default(),
                    }),
                    multisample: Default::default(),
                    multiview: None,
                    cache: None,
                })
            };
        let world = pipeline("lit world", "vs", Some("fs"), true, true);
        let shadow = pipeline("moon shadows", "shadow", None, true, true);
        let sky = pipeline("cloud sky", "full", Some("sky"), false, false);
        let post_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: None,
            entries: &[
                wgpu::BindGroupLayoutEntry {
                    binding: 0,
                    visibility: wgpu::ShaderStages::FRAGMENT,
                    ty: wgpu::BindingType::Texture {
                        sample_type: wgpu::TextureSampleType::Float { filterable: true },
                        view_dimension: wgpu::TextureViewDimension::D2,
                        multisampled: false,
                    },
                    count: None,
                },
                wgpu::BindGroupLayoutEntry {
                    binding: 1,
                    visibility: wgpu::ShaderStages::FRAGMENT,
                    ty: wgpu::BindingType::Sampler(wgpu::SamplerBindingType::Filtering),
                    count: None,
                },
            ],
        });
        let post_pipe = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
            label: None,
            bind_group_layouts: &[&post_layout],
            push_constant_ranges: &[],
        });
        let post_shader = device.create_shader_module(wgpu::include_wgsl!("post.wgsl"));
        let post = device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
            label: Some("bloom and tone map"),
            layout: Some(&post_pipe),
            vertex: wgpu::VertexState {
                module: &post_shader,
                entry_point: Some("vs"),
                buffers: &[],
                compilation_options: Default::default(),
            },
            fragment: Some(wgpu::FragmentState {
                module: &post_shader,
                entry_point: Some("fs"),
                targets: &[Some(wgpu::ColorTargetState {
                    format,
                    blend: None,
                    write_mask: wgpu::ColorWrites::ALL,
                })],
                compilation_options: Default::default(),
            }),
            primitive: Default::default(),
            depth_stencil: None,
            multisample: Default::default(),
            multiview: None,
            cache: None,
        });
        let hdr = texture(&device, 1280, 720, wgpu::TextureFormat::Rgba16Float);
        let depth = texture(&device, 1280, 720, wgpu::TextureFormat::Depth32Float);
        let post_group = Self::post_group(&device, &post_layout, &hdr);
        let static_mesh = crate::scene::forest();
        let static_count = static_mesh.vertices.len() as u32;
        let static_buf = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("Blackpine geometry"),
            contents: bytemuck::cast_slice(&static_mesh.vertices),
            usage: wgpu::BufferUsages::VERTEX,
        });
        let dynamic_buf = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("characters and effects"),
            size: 16 * 1024 * 1024,
            usage: wgpu::BufferUsages::VERTEX | wgpu::BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });
        if let Some(error) = device.pop_error_scope().await {
            return Err(error.to_string());
        }
        Ok(Self {
            device,
            queue,
            surface,
            config,
            uniform,
            group,
            world_layout: layout,
            shadow_sampler: sampler,
            lights: std::array::from_fn(|i| {
                if i < LIGHTS.len() {
                    let l = LIGHTS[i];
                    [l[0], l[1], l[2], 12.]
                } else {
                    [0.; 4]
                }
            }),
            light_colors: std::array::from_fn(|i| {
                if i < LIGHTS.len() {
                    [1., 0.48, 0.15, 8.]
                } else {
                    [0.; 4]
                }
            }),
            shadow_group,
            world,
            shadow,
            sky,
            post,
            post_layout,
            post_group,
            depth,
            hdr,
            shadow_view,
            static_buf,
            static_count,
            dynamic_buf,
            triangles: 0,
        })
    }
    fn atlas(
        d: &wgpu::Device,
        q: &wgpu::Queue,
        rgba: &[u8],
        width: u32,
        height: u32,
    ) -> wgpu::TextureView {
        let t = d.create_texture(&wgpu::TextureDescriptor {
            label: Some("Recovered procedural material atlas"),
            size: wgpu::Extent3d {
                width,
                height,
                depth_or_array_layers: 1,
            },
            mip_level_count: 1,
            sample_count: 1,
            dimension: wgpu::TextureDimension::D2,
            format: wgpu::TextureFormat::Rgba8UnormSrgb,
            usage: wgpu::TextureUsages::TEXTURE_BINDING | wgpu::TextureUsages::COPY_DST,
            view_formats: &[],
        });
        q.write_texture(
            wgpu::TexelCopyTextureInfo {
                texture: &t,
                mip_level: 0,
                origin: wgpu::Origin3d::ZERO,
                aspect: wgpu::TextureAspect::All,
            },
            rgba,
            wgpu::TexelCopyBufferLayout {
                offset: 0,
                bytes_per_row: Some(width * 4),
                rows_per_image: Some(height),
            },
            wgpu::Extent3d {
                width,
                height,
                depth_or_array_layers: 1,
            },
        );
        t.create_view(&Default::default())
    }
    fn world_group(
        d: &wgpu::Device,
        l: &wgpu::BindGroupLayout,
        u: &wgpu::Buffer,
        shadow: &wgpu::TextureView,
        ss: &wgpu::Sampler,
        atlas: &wgpu::TextureView,
    ) -> wgpu::BindGroup {
        let nearest = d.create_sampler(&wgpu::SamplerDescriptor {
            mag_filter: wgpu::FilterMode::Nearest,
            min_filter: wgpu::FilterMode::Nearest,
            ..Default::default()
        });
        d.create_bind_group(&wgpu::BindGroupDescriptor {
            label: None,
            layout: l,
            entries: &[
                wgpu::BindGroupEntry {
                    binding: 0,
                    resource: u.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 1,
                    resource: wgpu::BindingResource::TextureView(shadow),
                },
                wgpu::BindGroupEntry {
                    binding: 2,
                    resource: wgpu::BindingResource::Sampler(ss),
                },
                wgpu::BindGroupEntry {
                    binding: 3,
                    resource: wgpu::BindingResource::TextureView(atlas),
                },
                wgpu::BindGroupEntry {
                    binding: 4,
                    resource: wgpu::BindingResource::Sampler(&nearest),
                },
            ],
        })
    }
    pub fn load_reference(
        &mut self,
        vertices: &[u8],
        rgba: &[u8],
        width: u32,
        height: u32,
    ) -> Result<(), String> {
        if vertices.len() % std::mem::size_of::<Vertex>() != 0
            || vertices.len() > 180_000_000
            || width == 0
            || height == 0
            || width > 4096
            || height > 4096
            || rgba.len() != width as usize * height as usize * 4
        {
            return Err("Invalid recovered scene data".into());
        }
        self.static_buf = self
            .device
            .create_buffer_init(&wgpu::util::BufferInitDescriptor {
                label: Some("Recovered original world geometry"),
                contents: vertices,
                usage: wgpu::BufferUsages::VERTEX,
            });
        self.static_count = (vertices.len() / std::mem::size_of::<Vertex>()) as u32;
        let atlas = Self::atlas(&self.device, &self.queue, rgba, width, height);
        self.group = Self::world_group(
            &self.device,
            &self.world_layout,
            &self.uniform,
            &self.shadow_view,
            &self.shadow_sampler,
            &atlas,
        );
        Ok(())
    }
    fn post_group(
        d: &wgpu::Device,
        l: &wgpu::BindGroupLayout,
        v: &wgpu::TextureView,
    ) -> wgpu::BindGroup {
        let s = d.create_sampler(&wgpu::SamplerDescriptor {
            mag_filter: wgpu::FilterMode::Linear,
            min_filter: wgpu::FilterMode::Linear,
            ..Default::default()
        });
        d.create_bind_group(&wgpu::BindGroupDescriptor {
            label: None,
            layout: l,
            entries: &[
                wgpu::BindGroupEntry {
                    binding: 0,
                    resource: wgpu::BindingResource::TextureView(v),
                },
                wgpu::BindGroupEntry {
                    binding: 1,
                    resource: wgpu::BindingResource::Sampler(&s),
                },
            ],
        })
    }
    pub fn resize(&mut self, w: u32, h: u32) {
        let w = w.clamp(1, 2560);
        let h = h.clamp(1, 1440);
        if w == self.config.width && h == self.config.height {
            return;
        }
        self.config.width = w;
        self.config.height = h;
        self.surface.configure(&self.device, &self.config);
        self.hdr = texture(&self.device, w, h, wgpu::TextureFormat::Rgba16Float);
        self.depth = texture(&self.device, w, h, wgpu::TextureFormat::Depth32Float);
        self.post_group = Self::post_group(&self.device, &self.post_layout, &self.hdr);
    }
    pub fn draw(
        &mut self,
        eye: Vec3,
        yaw: f32,
        pitch: f32,
        time: f32,
        dynamic: Mesh,
    ) -> Result<(), String> {
        let direction = Vec3::new(
            -yaw.sin() * pitch.cos(),
            pitch.sin(),
            -yaw.cos() * pitch.cos(),
        );
        let view = Mat4::look_at_rh(eye, eye + direction, Vec3::Y);
        let vp = Mat4::perspective_rh(
            70f32.to_radians(),
            self.config.width as f32 / self.config.height as f32,
            0.05,
            180.,
        ) * view;
        let light_vp = Mat4::orthographic_rh(-46., 46., -46., 46., 0.1, 150.)
            * Mat4::look_at_rh(Vec3::new(5.02, 50.2, -86.34), Vec3::ZERO, Vec3::Y);
        let globals = Globals {
            vp: vp.to_cols_array_2d(),
            light_vp: light_vp.to_cols_array_2d(),
            inverse_vp: vp.inverse().to_cols_array_2d(),
            eye: [eye.x, eye.y, eye.z, time],
            lights: self.lights,
            light_colors: self.light_colors,
            screen: [self.config.width as f32, self.config.height as f32, 0., 0.],
        };
        self.queue
            .write_buffer(&self.uniform, 0, bytemuck::bytes_of(&globals));
        let count = dynamic.vertices.len() as u32;
        if count as usize * std::mem::size_of::<Vertex>() > 16 * 1024 * 1024 {
            return Err("Dynamic scene budget exceeded".into());
        }
        self.queue.write_buffer(
            &self.dynamic_buf,
            0,
            bytemuck::cast_slice(&dynamic.vertices),
        );
        self.triangles = (count + self.static_count) / 3;
        let frame = match self.surface.get_current_texture() {
            Ok(v) => v,
            Err(wgpu::SurfaceError::Lost | wgpu::SurfaceError::Outdated) => {
                self.surface.configure(&self.device, &self.config);
                return Ok(());
            }
            Err(wgpu::SurfaceError::Timeout) => return Ok(()),
            Err(e) => return Err(e.to_string()),
        };
        let output = frame.texture.create_view(&Default::default());
        let mut encoder = self.device.create_command_encoder(&Default::default());
        {
            let mut pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
                label: Some("moon shadow map"),
                color_attachments: &[],
                depth_stencil_attachment: Some(wgpu::RenderPassDepthStencilAttachment {
                    view: &self.shadow_view,
                    depth_ops: Some(wgpu::Operations {
                        load: wgpu::LoadOp::Clear(1.),
                        store: wgpu::StoreOp::Store,
                    }),
                    stencil_ops: None,
                }),
                timestamp_writes: None,
                occlusion_query_set: None,
            });
            pass.set_pipeline(&self.shadow);
            pass.set_bind_group(0, &self.shadow_group, &[]);
            pass.set_vertex_buffer(0, self.static_buf.slice(..));
            pass.draw(0..self.static_count, 0..1);
        }
        {
            let mut pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
                label: Some("forest and combat"),
                color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                    view: &self.hdr,
                    resolve_target: None,
                    ops: wgpu::Operations {
                        load: wgpu::LoadOp::Clear(wgpu::Color::BLACK),
                        store: wgpu::StoreOp::Store,
                    },
                })],
                depth_stencil_attachment: Some(wgpu::RenderPassDepthStencilAttachment {
                    view: &self.depth,
                    depth_ops: Some(wgpu::Operations {
                        load: wgpu::LoadOp::Clear(1.),
                        store: wgpu::StoreOp::Store,
                    }),
                    stencil_ops: None,
                }),
                timestamp_writes: None,
                occlusion_query_set: None,
            });
            pass.set_bind_group(0, &self.group, &[]);
            pass.set_pipeline(&self.sky);
            pass.draw(0..3, 0..1);
            pass.set_pipeline(&self.world);
            pass.set_vertex_buffer(0, self.static_buf.slice(..));
            pass.draw(0..self.static_count, 0..1);
            pass.set_vertex_buffer(0, self.dynamic_buf.slice(..));
            pass.draw(0..count, 0..1);
        }
        {
            let mut pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
                label: Some("display"),
                color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                    view: &output,
                    resolve_target: None,
                    ops: wgpu::Operations {
                        load: wgpu::LoadOp::Clear(wgpu::Color::BLACK),
                        store: wgpu::StoreOp::Store,
                    },
                })],
                depth_stencil_attachment: None,
                timestamp_writes: None,
                occlusion_query_set: None,
            });
            pass.set_pipeline(&self.post);
            pass.set_bind_group(0, &self.post_group, &[]);
            pass.draw(0..3, 0..1);
        }
        self.queue.submit(Some(encoder.finish()));
        frame.present();
        Ok(())
    }
}
