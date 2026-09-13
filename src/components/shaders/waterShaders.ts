// GLSL Shaders for realistic beach sand, dynamic ocean wave surge, and foamy wash

export const SandVertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldPosition;
  varying vec3 vNormal;

  void main() {
    vUv = uv;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

export const SandFragmentShader = /* glsl */ `
  uniform sampler2D uSandCarveMap;
  uniform float uWaveProgress;
  uniform float uWetSandFactor;
  uniform vec3 uSunDirection;
  uniform vec3 uSunColor;
  uniform float uTime;

  varying vec2 vUv;
  varying vec3 vWorldPosition;
  varying vec3 vNormal;

  // Pseudo-random noise for sand grain micro-texture
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), f.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }

  void main() {
    // 1. Natural base sand colors (warm golden seashore)
    vec3 drySand = vec3(0.89, 0.77, 0.58);
    vec3 dampSand = vec3(0.73, 0.59, 0.42);
    vec3 deepWetSand = vec3(0.48, 0.36, 0.24);

    // Subtle grain variation
    float grain = noise(vUv * 800.0) * 0.08 - 0.04;
    float slopeGrad = smoothstep(0.0, 1.0, vUv.y); // Damp closer to water (top), slightly drier down-beach
    vec3 baseColor = mix(dampSand, drySand, 1.0 - slopeGrad * 0.4) + vec3(grain);

    // 2. Carve groove dynamic texture from 2D Canvas
    vec4 carveTex = texture2D(uSandCarveMap, vUv);
    float carveDepth = carveTex.a;

    // Normal disturbance from carve texture (simulating 3D trench groove)
    vec2 texel = vec2(1.0 / 2048.0, 1.0 / 1152.0);
    float left = texture2D(uSandCarveMap, vUv - vec2(texel.x, 0.0)).a;
    float right = texture2D(uSandCarveMap, vUv + vec2(texel.x, 0.0)).a;
    float up = texture2D(uSandCarveMap, vUv + vec2(0.0, texel.y)).a;
    float down = texture2D(uSandCarveMap, vUv - vec2(0.0, texel.y)).a;

    vec3 normalMod = normalize(vNormal + vec3((left - right) * 2.5, (down - up) * 2.5, 0.0));

    // Carve tint: exposed moist dark sand inside trench
    vec3 carveColor = mix(baseColor * 0.45, vec3(0.22, 0.13, 0.08), 0.75);
    baseColor = mix(baseColor, carveColor, carveDepth * 0.95);

    // 3. Wet sand effect left behind by receding wave
    // Water reaches down according to uWetSandFactor
    float wetEdge = smoothstep(1.0 - uWetSandFactor - 0.08, 1.0 - uWetSandFactor, vUv.y);
    float wetness = clamp(wetEdge * uWetSandFactor, 0.0, 1.0);

    // Darken wet sand
    baseColor = mix(baseColor, baseColor * 0.58, wetness * 0.85);

    // 4. Lighting & Specular reflection
    vec3 lightDir = normalize(uSunDirection);
    vec3 viewDir = normalize(cameraPosition - vWorldPosition);
    vec3 halfVector = normalize(lightDir + viewDir);

    float diff = max(dot(normalMod, lightDir), 0.0);
    vec3 ambient = vec3(0.42, 0.48, 0.55) * baseColor;
    vec3 diffuse = uSunColor * baseColor * diff;

    // Specular shine on glossy wet sand (mirror reflections of sun & sky)
    float wetSpecular = pow(max(dot(normalMod, halfVector), 0.0), 90.0) * wetness * 2.2;
    float drySpecular = pow(max(dot(normalMod, halfVector), 0.0), 12.0) * (1.0 - wetness) * 0.08;

    // Subtle sky reflection on wet sand sheen
    vec3 skyReflection = vec3(0.55, 0.78, 0.95) * wetness * 0.28 * max(0.0, normalMod.y);

    vec3 finalColor = ambient + diffuse + vec3(wetSpecular) * uSunColor + vec3(drySpecular) + skyReflection;

    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

export const OceanVertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uWaveProgress;
  uniform float uSurgeAmplitude;

  varying vec2 vUv;
  varying vec3 vWorldPosition;
  varying vec3 vNormal;
  varying float vWaveHeight;
  varying float vFoamFactor;

  // Gerstner Wave displacement function
  vec3 gerstnerWave(vec2 dir, float steepness, float wavelength, vec3 pos, float time) {
    float k = 2.0 * 3.14159265 / wavelength;
    float c = sqrt(9.8 / k);
    vec2 d = normalize(dir);
    float f = k * (dot(d, pos.xz) - c * time);
    float a = steepness / k;

    return vec3(
      d.x * (a * cos(f)),
      a * sin(f),
      d.y * (a * cos(f))
    );
  }

  void main() {
    vUv = uv;
    vec3 pos = position;

    // Ambient rhythmic swells
    vec3 wave1 = gerstnerWave(vec2(0.0, 1.0), 0.18, 4.0, pos, uTime * 1.6);
    vec3 wave2 = gerstnerWave(vec2(0.2, 0.9), 0.12, 2.2, pos, uTime * 2.2);
    vec3 wave3 = gerstnerWave(vec2(-0.15, 0.95), 0.08, 1.1, pos, uTime * 3.4);

    vec3 totalWave = wave1 + wave2 + wave3;

    // Big ocean surge wave: rolling crest moving forward along the beach
    // Wave moves from high-Y down toward low-Y as uWaveProgress increases
    float waveCenter = mix(1.15, 0.18, uWaveProgress);
    float waveDist = abs(vUv.y - waveCenter);
    float surgeCrest = exp(-waveDist * waveDist * 28.0) * uSurgeAmplitude;

    // The water body extends behind the crest (toward deep ocean at top)
    float waterBody = smoothstep(waveCenter - 0.06, waveCenter + 0.15, vUv.y);

    pos.y += totalWave.y * (0.4 + waterBody * 0.6) + surgeCrest * 0.85;
    pos.z -= totalWave.z * 0.3;

    vWaveHeight = pos.y;
    vFoamFactor = surgeCrest * 2.5 + clamp(totalWave.y * 1.5, 0.0, 1.0);

    vec4 worldPos = modelMatrix * vec4(pos, 1.0);
    vWorldPosition = worldPos.xyz;
    vNormal = normalize(normalMatrix * vec3(0.0, 1.0, 0.0));

    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

export const OceanFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uWaveProgress;
  uniform vec3 uSunDirection;
  uniform vec3 uSunColor;
  uniform sampler2D uFoamNoiseMap;

  varying vec2 vUv;
  varying vec3 vWorldPosition;
  varying vec3 vNormal;
  varying float vWaveHeight;
  varying float vFoamFactor;

  // Simple procedural noise for foam lacing and water caustics
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    vec2 shift = vec2(100.0);
    mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
    for (int i = 0; i < 4; ++i) {
      v += a * hash(p);
      p = rot * p * 2.0 + shift;
      a *= 0.5;
    }
    return v;
  }

  // Voronoi cellular noise for seafoam bubbles & caustics
  float voronoi(vec2 x) {
    vec2 n = floor(x);
    vec2 f = fract(x);
    float m = 8.0;
    for (int j = -1; j <= 1; j++) {
      for (int i = -1; i <= 1; i++) {
        vec2 g = vec2(float(i), float(j));
        vec2 o = vec2(hash(n + g), hash(n + g + vec2(13.2, 7.8)));
        vec2 r = g - f + o;
        float d = dot(r, r);
        m = min(m, d);
      }
    }
    return sqrt(m);
  }

  void main() {
    // Current wave crest front position (moving from ~0.9 down to 0.15 on vUv.y)
    float waveFront = mix(0.95, 0.12, uWaveProgress);

    // Only render water behind the wave front
    float waterPresence = smoothstep(waveFront - 0.03, waveFront + 0.04, vUv.y);
    if (waterPresence <= 0.005) {
      discard;
    }

    // 1. Tropical Sea Water Palette
    vec3 deepWater = vec3(0.04, 0.38, 0.52);   // Deep turquoise
    vec3 shallowWater = vec3(0.18, 0.72, 0.76); // Crystal aquamarine
    vec3 foamColor = vec3(0.97, 0.99, 1.0);    // Crisp white crest foam

    // Water depth gradient along the beach slope
    float depthFactor = smoothstep(waveFront, waveFront + 0.55, vUv.y);
    vec3 waterColor = mix(shallowWater, deepWater, depthFactor);

    // 2. Animated Caustics & Shimmer
    vec2 causticUv = vUv * 35.0 + vec2(uTime * 0.25, uTime * 0.15);
    float caustic = voronoi(causticUv);
    caustic = smoothstep(0.4, 0.9, 1.0 - caustic) * (1.0 - depthFactor * 0.6);
    waterColor += vec3(0.2, 0.35, 0.3) * caustic * 0.65;

    // 3. Procedural Foam Crest & Bubbles
    // Dense foam line right at the surging wave front
    float edgeDist = abs(vUv.y - waveFront);
    float frontFoamBand = smoothstep(0.08, 0.0, edgeDist);

    // Voronoi bubbly foam pattern
    vec2 foamUv = vUv * vec2(45.0, 90.0) + vec2(sin(uTime * 1.5 + vUv.x * 12.0) * 0.3, -uTime * 0.5);
    float foamPattern = voronoi(foamUv);
    float foamLace = smoothstep(0.28, 0.75, 1.0 - foamPattern);

    // Wave crest turbulence
    float turbulence = fbm(vUv * 60.0 + vec2(uTime * 0.4, -uTime * 0.8));
    float totalFoam = clamp(frontFoamBand * 1.6 + foamLace * 0.85 * frontFoamBand + vFoamFactor * 0.5 + turbulence * 0.25, 0.0, 1.0);

    // Mix water and foam
    vec3 finalColor = mix(waterColor, foamColor, smoothstep(0.25, 0.65, totalFoam));

    // 4. Sun Highlights & Specular Reflection
    vec3 lightDir = normalize(uSunDirection);
    vec3 viewDir = normalize(cameraPosition - vWorldPosition);
    vec3 halfVector = normalize(lightDir + viewDir);

    float spec = pow(max(dot(vNormal, halfVector), 0.0), 120.0);
    finalColor += uSunColor * spec * 1.8;

    // 5. Water Transparency: crisp clear shallow edge, thick opaque foam, translucent turquoise body
    float alpha = mix(waterPresence * 0.82, 0.98, smoothstep(0.3, 0.7, totalFoam));
    alpha = clamp(alpha, 0.0, 1.0);

    gl_FragColor = vec4(finalColor, alpha);
  }
`;
