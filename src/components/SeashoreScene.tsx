'use client';

import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { SandCanvasManager } from './SandCanvasManager';
import {
  SandVertexShader,
  SandFragmentShader,
  OceanVertexShader,
  OceanFragmentShader,
} from './shaders/waterShaders';
import { oceanAudio } from './AudioEngine';

interface SeashoreSceneProps {
  sandManager: SandCanvasManager;
  isSurging: boolean;
  onSurgeComplete: () => void;
  timeOfDay: 'sunny' | 'sunset';
  cameraPreset: 'drone' | 'shore' | 'horizon';
}

export const SeashoreScene: React.FC<SeashoreSceneProps> = ({
  sandManager,
  isSurging,
  onSurgeComplete,
  timeOfDay,
  cameraPreset,
}) => {
  const { camera } = useThree();
  const sandMeshRef = useRef<THREE.Mesh>(null);
  const oceanMeshRef = useRef<THREE.Mesh>(null);

  // Surge animation state tracking
  const surgeState = useRef<{
    active: boolean;
    phase: 'idle' | 'surging' | 'cresting' | 'receding';
    progress: number;
    timer: number;
    maxWetReach: number;
    wetFactor: number;
  }>({
    active: false,
    phase: 'idle',
    progress: 0.0,
    timer: 0,
    maxWetReach: 0.0,
    wetFactor: 0.0,
  });

  // Lighting parameters based on time of day
  const lightConfig = useMemo(() => {
    if (timeOfDay === 'sunset') {
      return {
        sunDirection: new THREE.Vector3(0.5, 0.4, -0.8).normalize(),
        sunColor: new THREE.Vector3(1.2, 0.75, 0.45),
        ambientIntensity: 0.5,
        skyColor: '#fdba74',
      };
    }
    return {
      sunDirection: new THREE.Vector3(0.3, 0.9, -0.4).normalize(),
      sunColor: new THREE.Vector3(1.05, 1.0, 0.92),
      ambientIntensity: 0.75,
      skyColor: '#7dd3fc',
    };
  }, [timeOfDay]);

  // Sand Shader Material Uniforms
  const sandUniforms = useMemo(() => {
    return {
      uSandCarveMap: { value: sandManager.texture },
      uWaveProgress: { value: 0.0 },
      uWetSandFactor: { value: 0.0 },
      uSunDirection: { value: lightConfig.sunDirection },
      uSunColor: { value: lightConfig.sunColor },
      uTime: { value: 0.0 },
    };
  }, [sandManager.texture, lightConfig]);

  // Ocean Shader Material Uniforms
  const oceanUniforms = useMemo(() => {
    return {
      uTime: { value: 0.0 },
      uWaveProgress: { value: 0.0 },
      uSurgeAmplitude: { value: 0.45 },
      uSunDirection: { value: lightConfig.sunDirection },
      uSunColor: { value: lightConfig.sunColor },
    };
  }, [lightConfig]);

  // Update light uniforms when timeOfDay changes
  useEffect(() => {
    sandUniforms.uSunDirection.value = lightConfig.sunDirection;
    sandUniforms.uSunColor.value = lightConfig.sunColor;
    oceanUniforms.uSunDirection.value = lightConfig.sunDirection;
    oceanUniforms.uSunColor.value = lightConfig.sunColor;
  }, [lightConfig, sandUniforms, oceanUniforms]);

  // Trigger surge initiation
  useEffect(() => {
    if (isSurging && !surgeState.current.active) {
      surgeState.current.active = true;
      surgeState.current.phase = 'surging';
      surgeState.current.timer = 0;
      oceanAudio.triggerSurgeSound(5.0);
    }
  }, [isSurging]);

  // Handle camera position presets smoothly
  const targetCamPos = useMemo(() => {
    switch (cameraPreset) {
      case 'shore':
        return { pos: new THREE.Vector3(0, 7.5, 9.5), look: new THREE.Vector3(0, -0.5, 0) };
      case 'horizon':
        return { pos: new THREE.Vector3(0, 6.0, 13.0), look: new THREE.Vector3(0, 1.5, -4) };
      case 'drone':
      default:
        return { pos: new THREE.Vector3(0, 12.0, 12.5), look: new THREE.Vector3(0, 0, -0.5) };
    }
  }, [cameraPreset]);

  // Animation frame loop
  useFrame((state, delta) => {
    const time = state.clock.getElapsedTime();

    // Subtle natural camera sway (drone flight hover effect)
    const swayX = Math.sin(time * 0.4) * 0.15;
    const swayY = Math.cos(time * 0.3) * 0.08;
    camera.position.lerp(
      new THREE.Vector3(
        targetCamPos.pos.x + swayX,
        targetCamPos.pos.y + swayY,
        targetCamPos.pos.z
      ),
      0.04
    );
    camera.lookAt(targetCamPos.look);

    // Update time uniforms
    sandUniforms.uTime.value = time;
    oceanUniforms.uTime.value = time;

    // Handle Surge State Machine
    const s = surgeState.current;

    if (!s.active) {
      // Idle ambient wave motion: gentle lapping around tide line (progress 0.02 - 0.1)
      const ambientLap = 0.05 + Math.sin(time * 1.4) * 0.04;
      oceanUniforms.uWaveProgress.value = ambientLap;
      oceanUniforms.uSurgeAmplitude.value = 0.25;
      sandUniforms.uWaveProgress.value = ambientLap;

      // Slowly dry wet sand if damp
      if (s.wetFactor > 0.05) {
        s.wetFactor = Math.max(0.05, s.wetFactor - delta * 0.015);
        sandUniforms.uWetSandFactor.value = s.wetFactor;
      }
    } else {
      // Surging sequence
      s.timer += delta;

      if (s.phase === 'surging') {
        // Wave rolls rapidly forward across the beach
        // Ease-out curve into beach
        const surgeSpeed = 0.38; // ~2.4 seconds to reach max beach extension
        s.progress = Math.min(1.0, s.progress + delta * surgeSpeed);

        oceanUniforms.uWaveProgress.value = s.progress;
        oceanUniforms.uSurgeAmplitude.value = 0.65;
        sandUniforms.uWaveProgress.value = s.progress;

        // Wave wash-away erasure: as the foam front crosses UV coordinates,
        // synchronize wiping the sand canvas
        // UV y on sand plane: 1.0 (top/ocean) down to 0.0 (bottom/shore)
        // Canvas y: 0.0 (top) down to 1.0 (bottom)
        // When waveProgress = 0.0 -> wave is at top of beach (norm ~ 0.05)
        // When waveProgress = 1.0 -> wave is at bottom of beach (norm ~ 0.95)
        const foamFrontNorm = THREE.MathUtils.clamp(s.progress * 1.05, 0.0, 1.0);
        sandManager.washAwaySweep(foamFrontNorm);

        // Record wet sand reach
        s.maxWetReach = Math.max(s.maxWetReach, s.progress);
        s.wetFactor = s.maxWetReach;
        sandUniforms.uWetSandFactor.value = s.wetFactor;

        if (s.progress >= 0.98) {
          s.phase = 'cresting';
          s.timer = 0;
          // Final clean sweep to ensure no artifacts remain
          sandManager.washAwaySweep(1.0);
        }
      } else if (s.phase === 'cresting') {
        // Water lingers at peak shore reach with swirling foam
        if (s.timer > 0.6) {
          s.phase = 'receding';
          s.timer = 0;
        }
      } else if (s.phase === 'receding') {
        // Water drains smoothly back into the ocean
        const recedeSpeed = 0.28; // ~3.5 seconds to pull back
        s.progress = Math.max(0.05, s.progress - delta * recedeSpeed);

        oceanUniforms.uWaveProgress.value = s.progress;
        oceanUniforms.uSurgeAmplitude.value = THREE.MathUtils.lerp(0.65, 0.22, 1.0 - s.progress);
        sandUniforms.uWaveProgress.value = s.progress;

        // Wet sand remains glossy where the wave reached!
        sandUniforms.uWetSandFactor.value = s.maxWetReach;

        if (s.progress <= 0.06) {
          s.active = false;
          s.phase = 'idle';
          s.progress = 0.05;
          onSurgeComplete();
        }
      }
    }
  });

  // Pointer drawing event handlers on the 3D Sand mesh
  const isPointerDown = useRef(false);

  const handlePointerDown = (e: { uv?: THREE.Vector2; stopPropagation: () => void }) => {
    e.stopPropagation();
    isPointerDown.current = true;
    if (e.uv) {
      sandManager.handlePointer(e.uv, true);
    }
  };

  const handlePointerMove = (e: { uv?: THREE.Vector2 }) => {
    if (!isPointerDown.current) return;
    if (e.uv) {
      sandManager.handlePointer(e.uv, true);
    }
  };

  const handlePointerUp = () => {
    isPointerDown.current = false;
    sandManager.handlePointer(new THREE.Vector2(0, 0), false);
  };

  return (
    <group onPointerUp={handlePointerUp}>
      {/* Directional Sun Light */}
      <directionalLight
        position={[
          lightConfig.sunDirection.x * 20,
          lightConfig.sunDirection.y * 20,
          lightConfig.sunDirection.z * 20,
        ]}
        intensity={timeOfDay === 'sunset' ? 1.6 : 2.2}
        castShadow={false}
      />
      <ambientLight intensity={lightConfig.ambientIntensity} color={lightConfig.skyColor} />

      {/* 3D Sand Seashore Plane */}
      <mesh
        ref={sandMeshRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerUp}
      >
        <planeGeometry args={[26, 16, 64, 64]} />
        <shaderMaterial
          vertexShader={SandVertexShader}
          fragmentShader={SandFragmentShader}
          uniforms={sandUniforms}
        />
      </mesh>

      {/* Dynamic Ocean Water Mesh */}
      <mesh
        ref={oceanMeshRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.08, 0]}
      >
        <planeGeometry args={[26, 16, 140, 140]} />
        <shaderMaterial
          vertexShader={OceanVertexShader}
          fragmentShader={OceanFragmentShader}
          uniforms={oceanUniforms}
          transparent={true}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
};
