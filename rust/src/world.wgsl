struct Globals { vp:mat4x4<f32>, light_vp:mat4x4<f32>, inverse_vp:mat4x4<f32>, eye:vec4<f32>, lights:array<vec4<f32>,48>, light_colors:array<vec4<f32>,48>, screen:vec4<f32> }
@group(0) @binding(0) var<uniform> g:Globals;
@group(0) @binding(1) var shadow_tex:texture_depth_2d;
@group(0) @binding(2) var shadow_sampler:sampler_comparison;
@group(0) @binding(3) var atlas:texture_2d<f32>;
@group(0) @binding(4) var atlas_sampler:sampler;
struct Vertex { @location(0) p:vec3<f32>, @location(1) n:vec3<f32>, @location(2) c:vec3<f32>, @location(3) mat:f32, @location(4) uv:vec2<f32> }
struct Out { @builtin(position) clip:vec4<f32>, @location(0) p:vec3<f32>, @location(1) n:vec3<f32>, @location(2) c:vec3<f32>, @location(3) @interpolate(flat) mat:f32, @location(4) uv:vec2<f32> }
@vertex fn vs(v:Vertex)->Out {var o:Out;o.clip=g.vp*vec4(v.p,1.);o.p=v.p;o.n=v.n;o.c=v.c;o.mat=v.mat;o.uv=v.uv;return o;}
@vertex fn shadow(v:Vertex)->@builtin(position) vec4<f32>{return g.light_vp*vec4(v.p,1.);}
fn hash(p:vec3<f32>)->f32 {return fract(sin(dot(p,vec3(12.9898,78.233,37.719)))*43758.5453);}
fn noise(p:vec3<f32>)->f32 {let i=floor(p);let f=fract(p);let u=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1.,0.,0.)),u.x),mix(hash(i+vec3(0.,1.,0.)),hash(i+vec3(1.,1.,0.)),u.x),u.y),mix(mix(hash(i+vec3(0.,0.,1.)),hash(i+vec3(1.,0.,1.)),u.x),mix(hash(i+vec3(0.,1.,1.)),hash(i+vec3(1.)),u.x),u.y),u.z);}
fn visibility(p:vec3<f32>,n:vec3<f32>)->f32 {let c=g.light_vp*vec4(p+n*0.03,1.);let q=c.xyz/c.w;let uv=q.xy*vec2(0.5,-0.5)+0.5;if any(uv<vec2(0.))||any(uv>vec2(1.)) {return 1.;}var s=0.;for(var y=-1;y<=1;y++){for(var x=-1;x<=1;x++){s+=textureSampleCompareLevel(shadow_tex,shadow_sampler,uv+vec2(f32(x),f32(y))/2048.,q.z-0.0006);}}return s/9.;}
@fragment fn fs(v:Out)->@location(0) vec4<f32>{
 let n=normalize(v.n);let p=v.p;let grain=hash(floor(p*24.));let broad=noise(p*1.8);var base=v.c*(0.60+grain*0.50+broad*0.25);
 if v.mat<0.5 {let moss=noise(floor(p*8.)/8.*0.9);let dirt=noise(p*0.25);base=mix(vec3(0.15,0.12,0.075),vec3(0.17,0.22,0.085),smoothstep(0.28,0.72,moss))*(0.5+grain*0.65);base*=0.8+dirt*0.55;}
 if v.mat>0.5 && v.mat<1.5 {let fleck=noise(floor(p*20.)/20.*3.);base*=0.72+fleck*0.5;let moss=noise(p*2.5);base=mix(base,base*vec3(0.65,0.82,0.4),smoothstep(0.57,0.78,moss)*clamp(n.y+0.3,0.,1.));}
 if v.mat>1.5 && v.mat<2.5 {base*=0.72+noise(vec3(p.x*22.,p.y*2.,p.z*22.))*0.55;}
 if v.mat>9.5 {base=textureSampleLevel(atlas,atlas_sampler,v.uv,0.).rgb*v.c;}
 if v.mat>10.5 {let pixel=floor(p*24.)/24.;let pigment=(vec3(70.,67.,48.)+vec3((noise(pixel*1.8)-0.5)*34.+(grain-0.5)*25.))/255.;base=pow((pigment+0.055)/1.055,vec3(2.4))*v.c;}
 let moon=normalize(vec3(0.05,0.502,-0.863));let shadow=visibility(p,n);
 var lighting=vec3(0.086,0.111,0.128)+vec3(0.48,0.60,0.72)*max(dot(n,moon),0.)*shadow;
 for(var i=0u;i<48u;i++){if g.lights[i].w<0.1 {continue;}let d=g.lights[i].xyz-p;let dist=length(d);let flicker=0.90+0.06*sin(g.eye.w*8.+f32(i)*2.)+0.04*sin(g.eye.w*17.+f32(i));let a=g.light_colors[i].w*pow(max(1.-pow(dist/g.lights[i].w,4.),0.),2.)/(1.+dist*dist*0.4)*flicker;lighting+=g.light_colors[i].rgb*max(dot(n,normalize(d)),0.08)*a;}
 var color=base*lighting;
 if v.mat>2.5&&v.mat<3.5 {let h=normalize(moon+normalize(g.eye.xyz-p));color+=vec3(0.24,0.25,0.27)*pow(max(dot(n,h),0.),40.)*shadow;}
 if v.mat>4.5&&v.mat<5.5 {color=v.c;}
 let dist=distance(g.eye.xyz,p);let fog=1.-exp(-max(0.,dist-9.)*0.024);color=mix(color,vec3(0.038,0.064,0.078),fog*0.88);
 return vec4(color,1.);
}
struct Screen { @builtin(position) clip:vec4<f32>, @location(0) uv:vec2<f32> }
@vertex fn full(@builtin(vertex_index) i:u32)->Screen {let uv=vec2(f32((i<<1u)&2u),f32(i&2u));var o:Screen;o.clip=vec4(uv*vec2(2.,-2.)+vec2(-1.,1.),0.9999,1.);o.uv=uv;return o;}
@fragment fn sky(v:Screen)->@location(0) vec4<f32>{let q=g.inverse_vp*vec4(v.uv*vec2(2.,-2.)+vec2(-1.,1.),1.,1.);let ray=normalize(q.xyz/q.w-g.eye.xyz);let moon=normalize(vec3(-0.1,0.55,-0.83));let disc=dot(ray,moon);var col=mix(vec3(0.105,0.12,0.14),vec3(0.018,0.032,0.055),clamp(ray.y*1.6,0.,1.));
 let cloud=noise(ray*7.+vec3(g.eye.w*0.012,0.,0.))*0.6+noise(ray*18.+vec3(g.eye.w*0.02,0.,0.))*0.3;col+=vec3(0.08,0.085,0.09)*smoothstep(0.3,0.8,cloud);col+=vec3(0.13,0.15,0.17)*pow(max(disc,0.),35.);
 if disc>0.9985 {col=mix(vec3(0.53,0.55,0.51),vec3(0.95,0.96,0.86),noise(ray*170.));}col*=1.-smoothstep(0.63,0.86,cloud)*0.67;return vec4(col*0.32,1.);}
