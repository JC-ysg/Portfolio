// Enables code highlighting for GLSL code
const glsl = x => x;

// Fragment shader code (updated)
const frag = glsl`
precision highp float;
#define ITERS 128
#define PI 3.141592654
uniform float width;
uniform float height;
uniform float time;

// Normalize screen coordinates and correct for aspect ratio
vec2 normalizeScreenCoords() {
  float aspectRatio = width / height;
  vec2 result = 2.0 * (gl_FragCoord.xy / vec2(width, height) - 0.5);
  result.x *= aspectRatio; 
  return result;
}

float rand(vec2 c) {
  return fract(sin(dot(c.xy, vec2(12.9898, 78.233))) * 43758.5453);
}

float noise(vec2 p, float freq) {
  float unit = width / freq;
  vec2 ij = floor(p / unit);
  vec2 xy = mod(p, unit) / unit;
  xy = 0.5 * (1.0 - cos(PI * xy));
  float a = rand(ij + vec2(0.0, 0.0));
  float b = rand(ij + vec2(1.0, 0.0));
  float c = rand(ij + vec2(0.0, 1.0));
  float d = rand(ij + vec2(1.0, 1.0));
  float x1 = mix(a, b, xy.x);
  float x2 = mix(c, d, xy.x);
  return mix(x1, x2, xy.y);
}

float pNoise(vec2 p, int res) {
  float persistance = 0.5;
  float n = 0.0;
  float normK = 0.0;
  float f = 4.0;
  float amp = 1.0;
  int iCount = 0;
  for (int i = 0; i < 50; i++) {
    n += amp * noise(p, f);
    f *= 2.0;
    normK += amp;
    amp *= persistance;
    if (iCount == res) break;
    iCount++;
  }
  float nf = n / normK;
  return nf * nf * nf * nf;
}

// Calculate camera's orthonormal basis
vec3 getCameraRayDir(vec2 uv, vec3 camPos, vec3 camTarget) {
  vec3 camForward = normalize(camTarget - camPos);
  vec3 camRight = normalize(cross(vec3(0.0, 1.0, 0.0), camForward));
  vec3 camUp = normalize(cross(camForward, camRight));
  float fPersp = 2.0;
  vec3 vDir = normalize(uv.x * camRight + uv.y * camUp + camForward * fPersp);
  return vDir;
}

// Distance function for a sphere
float sphere(vec3 p, float r) {
  return length(p) - r;
}

float deformation(vec3 pos) {
  return sin(time * 0.1) * 0.5 *
    sin(time * 0.3 + pos.x * 1.3 * sin(pos.y + time * 0.1)) *
    sin(time * 0.2 + pos.y * 1.6) * 
    sin(time * 0.2 + pos.z * 2.6);
}

float scene(vec3 pos) {
  float t = sphere(pos - vec3(0.0, 0.0, 10.0), 7.7) + deformation(pos);   
  return t;
}

vec3 calcNormal(vec3 pos) {
  vec2 eps = vec2(0.0, 1e-5);
  // Find the normal of the surface
  return normalize(vec3(
    scene(pos + eps.yxx) - scene(pos - eps.yxx),
    scene(pos + eps.xyx) - scene(pos - eps.xyx),
    scene(pos + eps.xxy) - scene(pos - eps.xxy)
  ));
}

// Cast a ray and return the distance to the first hit
float castRay(vec3 rayOrigin, vec3 rayDir) {
  float t = 0.0;
  for (int i = 0; i < ITERS; i++) {
    float res = scene(rayOrigin + rayDir * t);
    if (res < 1e-4) {
      return t;
    }
    t += res;
    if (t > 100.0) break; // Avoid infinite loops
  }
  return -1.0;
}

// Adjusted render function to apply a gradient of dark grey
vec4 render(vec3 rayOrigin, vec3 rayDir) {
  float t = castRay(rayOrigin, rayDir);
  if (t == -1.0) {
    return vec4(0.0, 0.0, 0.0, 0.0); // Background: transparent
  }
  vec3 p = rayOrigin + rayDir * t;
  vec3 norm = calcNormal(p);

  // Calculate the gradient based on the normal or position
  float gradient = dot(norm, vec3(0.0, 1.0, 0.0)) * 0.5 + 0.5; // Range [0,1]
  vec3 darkGrey = vec3(0.66); // Dark grey base color
  vec3 color = darkGrey * gradient; // Apply gradient
  

  return vec4(color, 1.0); // Object: opaque
}

void main() {
  vec3 camPos = vec3(0.0, 0.0, -1.0);
  vec3 camTarget = vec3(0.0);
  vec2 uv = normalizeScreenCoords();
  vec3 rayDir = getCameraRayDir(uv, camPos, camTarget);
  vec4 color = render(camPos, rayDir);
  gl_FragColor = color;
}
`;

// Vertex shader code (unchanged)
const vert = glsl`
precision highp float;
attribute vec2 position;

void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

// Initialize GLea with alpha enabled
const glea = new GLea({
  shaders: [
    GLea.fragmentShader(frag),
    GLea.vertexShader(vert)
  ],
  buffers: {
    'position': GLea.buffer(2, [1, 1,  -1, 1,  1, -1,  -1, -1])
  },
  glOptions: { alpha: true } // Enable alpha in the WebGL context
}).create();

// Enable blending
const { gl } = glea;
gl.enable(gl.BLEND);
gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

// Handle window resize
window.addEventListener('resize', () => {
  glea.resize();
});

// Animation loop
function loop(time) {
  glea.clear(); // Clear the canvas (clear color's alpha is 0 by default)
  glea.uni('width', glea.width);
  glea.uni('height', glea.height);
  glea.uni('time', time * 0.005);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  requestAnimationFrame(loop);
}

loop(0);
