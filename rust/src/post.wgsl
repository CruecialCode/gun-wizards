@group(0) @binding(0) var frame:texture_2d<f32>;
@group(0) @binding(1) var linear_sampler:sampler;
struct Out { @builtin(position) pos:vec4<f32>, @location(0) uv:vec2<f32> }
@vertex fn vs(@builtin(vertex_index) i:u32)->Out {let uv=vec2(f32((i<<1u)&2u),f32(i&2u));var o:Out;o.pos=vec4(uv*vec2(2.,-2.)+vec2(-1.,1.),0.,1.);o.uv=uv;return o;}
@fragment fn fs(v:Out)->@location(0) vec4<f32>{let texel=1./vec2<f32>(textureDimensions(frame));var c=textureSample(frame,linear_sampler,v.uv).rgb;var glow=vec3(0.);for(var y=-2;y<=2;y++){for(var x=-2;x<=2;x++){let s=textureSample(frame,linear_sampler,v.uv+vec2(f32(x),f32(y))*texel*3.).rgb;glow+=max(s-0.8,vec3(0.))/25.;}}c+=glow*0.5;c=1.-exp(-c*1.65);let vig=1.-0.42*pow(length((v.uv-0.5)*vec2(1.,0.8)),1.4);c*=vig;return vec4(pow(max(c,vec3(0.)),vec3(1./2.2)),1.);}
