import * as THREE from 'three';

export interface ValveConfig {
  valveType: 'INDUSTRIAL_DRONE' | 'QUADCOPTER' | 'BALL_VALVE' | 'GOOSENECK_FAUCET' | 'GATE_VALVE';
  openAngleDeg: number;
  explodedFactor: number;
  material: 'CARBON_FIBER' | 'ALUMINUM_7075' | 'TITANIUM' | 'POLYCARBONATE' | 'BRASS' | 'STAINLESS_STEEL' | 'CHROME' | 'BRONZE' | 'GOLD' | 'STAINLESS_316' | 'CHROME_PLATED' | 'CAST_BRONZE';
  handleColor: string;
  showWaterFlow?: boolean;
}

/**
 * High-Fidelity Industrial Quadcopter Drone 3D Assembly (SECP-DRONE-001)
 * Modeled according to aerospace UAV manufacturing standards with:
 * - CNC Carbon Fiber Decks with M3 countersunk holes & cable routing cutouts
 * - M3 Socket Head Cap Screws, knurled aluminum standoffs & locknuts
 * - 4x Brushless Outrunner Motors with copper windings & M3 mounting bolt pattern
 * - 4x Arm-mounted Electronic Speed Controllers (ESCs) with 3-phase wiring
 * - 4-Layer Flight Controller Stack with STM32 MCU, LEDs & PDB
 * - 6S LiPo Battery Pack with silicone leads & XT60 connector
 * - Folding GPS/GNSS mast with ceramic patch antenna
 * - 3-Axis Brushless Gimbal with anti-vibration damping balls & 4K camera
 * - True multi-stage exploded assembly disassembly (0% to 100%)
 */
export function buildIndustrialQuadcopterDrone(config: ValveConfig, wireframe: boolean = false): {
  group: THREE.Group;
  updateOpenAngle: (angle: number) => void;
  updateExplode: (factor: number) => void;
} {
  const group = new THREE.Group();

  const getMat = (color: number, metalness = 0.8, roughness = 0.2, transparent = false, opacity = 1.0) => {
    return new THREE.MeshStandardMaterial({
      color,
      metalness,
      roughness,
      wireframe,
      transparent,
      opacity,
      envMapIntensity: 1.2
    });
  };

  // Materials Definition
  const carbonMat = getMat(0x181e29, 0.4, 0.45); // Dark 3K twill matte carbon fiber
  const aluminumMat = getMat(0xd1d5db, 0.9, 0.18); // Aerospace Anodized 7075-T6 Aluminum
  const darkMetalMat = getMat(0x0f172a, 0.8, 0.25); // Dark hard-anodized motor bell / clamps
  const steelFastenerMat = getMat(0x475569, 0.85, 0.2); // Grade 12.9 high-tensile steel screws
  const copperMat = getMat(0xd97706, 0.85, 0.15); // Motor stator enamel copper windings
  const propMat = getMat(0x0284c7, 0.4, 0.25, true, 0.9); // High-durability glass-reinforced rotor
  const pcbMat = getMat(0x091e14, 0.3, 0.6); // Matte dark-green/black 4-layer FR4 PCB
  const goldPadMat = getMat(0xf59e0b, 0.95, 0.15); // Immersion Gold ENIG solder pads
  const siliconeRedMat = getMat(0xef4444, 0.1, 0.85); // High-temp 12AWG silicone wire
  const siliconeBlackMat = getMat(0x1e293b, 0.1, 0.85);
  const xt60YellowMat = getMat(0xeab308, 0.25, 0.45); // Authentic high-temp nylon XT60
  const lipoPackMat = getMat(0x1e293b, 0.2, 0.6); // Shrink-wrapped LiPo cell pack
  const lipoLabelMat = getMat(0xfacc15, 0.1, 0.5); // Yellow high-C discharge rating label
  const damperMat = getMat(0x38bdf8, 0.1, 0.9); // Vibration damping silicone balls
  const cameraLensMat = getMat(0x0369a1, 0.95, 0.05); // Optical camera lens
  const ledGreenMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });
  const ledBlueMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
  const ledRedMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });

  // Helper: Create an authentic M3 Socket Head Cap Screw (with hex drive recess)
  const createM3Screw = (length: number, headRadius = 2.8, headHeight = 2.4, screwMat = steelFastenerMat) => {
    const screwGroup = new THREE.Group();
    // Cylindrical Head
    const headGeo = new THREE.CylinderGeometry(headRadius, headRadius, headHeight, 16);
    const head = new THREE.Mesh(headGeo, screwMat);
    head.position.y = headHeight / 2;
    screwGroup.add(head);

    // Hex Socket Recess indentation on top of screw head
    const socketGeo = new THREE.CylinderGeometry(1.4, 1.4, 1.0, 6);
    const socketMat = new THREE.MeshBasicMaterial({ color: 0x090d16 });
    const socket = new THREE.Mesh(socketGeo, socketMat);
    socket.position.y = headHeight - 0.2;
    screwGroup.add(socket);

    // Threaded Shank
    const shankGeo = new THREE.CylinderGeometry(1.5, 1.5, length, 12);
    const shank = new THREE.Mesh(shankGeo, screwMat);
    shank.position.y = -length / 2;
    screwGroup.add(shank);

    return screwGroup;
  };

  // Helper: Create an authentic 30.5x30.5mm / 45mm Carbon Fiber Plate with real holes & slots
  const createCarbonDeckPlate = (plateRadius: number, isTopPlate: boolean) => {
    const shape = new THREE.Shape();
    const sides = 8;
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2 + Math.PI / 8;
      const r = i % 2 === 0 ? plateRadius : plateRadius * 0.92;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) shape.moveTo(px, py);
      else shape.lineTo(px, py);
    }
    shape.closePath();

    // 1. Hole patterns: 6 Standoff Holes around perimeter
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const hx = Math.cos(a) * 50;
      const hy = Math.sin(a) * 50;
      const hole = new THREE.Path();
      hole.absarc(hx, hy, 2.0, 0, Math.PI * 2, true);
      shape.holes.push(hole);
    }

    // 2. Flight Controller Stack 30.5 x 30.5 mm mounting pattern (4 holes at ±15.25mm)
    [-15.25, 15.25].forEach(dx => {
      [-15.25, 15.25].forEach(dy => {
        const fcHole = new THREE.Path();
        fcHole.absarc(dx, dy, 1.8, 0, Math.PI * 2, true);
        shape.holes.push(fcHole);
      });
    });

    // 3. Weight reduction cutouts & cable pass-through slots
    [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].forEach(angle => {
      const slot = new THREE.Path();
      const dist = 32;
      const cx = Math.cos(angle) * dist;
      const cy = Math.sin(angle) * dist;
      slot.moveTo(cx - 6, cy - 3);
      slot.lineTo(cx + 6, cy - 3);
      slot.lineTo(cx + 6, cy + 3);
      slot.lineTo(cx - 6, cy + 3);
      slot.closePath();
      shape.holes.push(slot);
    });

    const extrudeSettings = {
      depth: 2.5,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.5,
      bevelThickness: 0.5
    };

    const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geo.center();
    const mesh = new THREE.Mesh(geo, carbonMat);
    mesh.rotation.x = Math.PI / 2;
    return mesh;
  };

  // -------------------------------------------------------------
  // 1. CENTRAL FUSELAGE CHASSIS & MOUNTING HARDWARE
  // -------------------------------------------------------------
  const chassisGroup = new THREE.Group();
  chassisGroup.userData = { instanceId: 'DRONE-CHASSIS-001', name: 'Main Carbon Fuselage Chassis' };

  // Top Carbon Deck Plate
  const topPlateGroup = new THREE.Group();
  topPlateGroup.position.y = 12;
  const topPlate = createCarbonDeckPlate(62, true);
  topPlate.userData = { instanceId: 'DRONE-CHASSIS-001', partId: 'PART-CHASSIS-TOP' };
  topPlateGroup.add(topPlate);

  // Top Deck M3 Screws (6x steel socket screws into standoffs)
  const topScrewsGroup = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2;
    const screw = createM3Screw(8, 2.7, 2.2);
    screw.position.set(Math.cos(ang) * 50, 2.8, Math.sin(ang) * 50);
    topScrewsGroup.add(screw);

    // Beveled washer under screw head
    const washerGeo = new THREE.CylinderGeometry(3.5, 3.5, 0.6, 16);
    const washer = new THREE.Mesh(washerGeo, aluminumMat);
    washer.position.set(Math.cos(ang) * 50, 1.4, Math.sin(ang) * 50);
    topPlateGroup.add(washer);
  }
  topPlateGroup.add(topScrewsGroup);
  chassisGroup.add(topPlateGroup);

  // Bottom Carbon Deck Plate
  const bottomPlateGroup = new THREE.Group();
  bottomPlateGroup.position.y = -12;
  const bottomPlate = createCarbonDeckPlate(62, false);
  bottomPlate.userData = { instanceId: 'DRONE-CHASSIS-001', partId: 'PART-CHASSIS-BTM' };
  bottomPlateGroup.add(bottomPlate);

  // Bottom Deck M3 Screws (6x steel socket screws pointing upward)
  const bottomScrewsGroup = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2;
    const screw = createM3Screw(8, 2.7, 2.2);
    screw.rotation.x = Math.PI; // Facing up into standoff
    screw.position.set(Math.cos(ang) * 50, -2.8, Math.sin(ang) * 50);
    bottomScrewsGroup.add(screw);

    const washerGeo = new THREE.CylinderGeometry(3.5, 3.5, 0.6, 16);
    const washer = new THREE.Mesh(washerGeo, aluminumMat);
    washer.position.set(Math.cos(ang) * 50, -1.4, Math.sin(ang) * 50);
    bottomPlateGroup.add(washer);
  }
  bottomPlateGroup.add(bottomScrewsGroup);
  chassisGroup.add(bottomPlateGroup);

  // 6x Knurled Hexagonal Aluminum Standoffs connecting top and bottom decks
  const standoffsGroup = new THREE.Group();
  standoffsGroup.userData = { instanceId: 'DRONE-STANDOFFS-001' };
  const standoffMeshes: THREE.Mesh[] = [];
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2;
    // Hexagonal standoff body
    const standoffGeo = new THREE.CylinderGeometry(3.2, 3.2, 21.5, 6);
    const standoff = new THREE.Mesh(standoffGeo, aluminumMat);
    standoff.position.set(Math.cos(ang) * 50, 0, Math.sin(ang) * 50);
    standoff.userData = { instanceId: 'DRONE-STANDOFFS-001', partId: `PART-STANDOFF-00${i + 1}` };
    standoffMeshes.push(standoff);
    standoffsGroup.add(standoff);
  }
  chassisGroup.add(standoffsGroup);

  // -------------------------------------------------------------
  // 2. AVIONICS & FLIGHT CONTROLLER MULTI-LAYER STACK
  // -------------------------------------------------------------
  const avionicsGroup = new THREE.Group();
  avionicsGroup.position.y = 0;
  avionicsGroup.userData = { instanceId: 'DRONE-AVIONICS-ASSY' };

  // Lower tier: Power Distribution Board (PDB)
  const pdbGroup = new THREE.Group();
  pdbGroup.position.y = -4;
  const pdbGeo = new THREE.BoxGeometry(40, 1.8, 40);
  const pdbMesh = new THREE.Mesh(pdbGeo, pcbMat);
  pdbGroup.add(pdbMesh);

  // Gold copper pads around PDB perimeter for soldering ESCs
  for (let s = 0; s < 4; s++) {
    const ang = (s / 4) * Math.PI * 2;
    const padGeo = new THREE.BoxGeometry(4, 0.4, 3);
    const pad = new THREE.Mesh(padGeo, goldPadMat);
    pad.position.set(Math.cos(ang) * 16, 1.0, Math.sin(ang) * 16);
    pdbGroup.add(pad);
  }

  // 35V 1000uF Low-ESR Electrolytic Filter Capacitor on PDB
  const capGeo = new THREE.CylinderGeometry(5, 5, 14, 16);
  const capMesh = new THREE.Mesh(capGeo, darkMetalMat);
  capMesh.rotation.z = Math.PI / 2;
  capMesh.position.set(0, 5, -12);
  pdbGroup.add(capMesh);
  avionicsGroup.add(pdbGroup);

  // Upper tier: High-Performance Flight Controller (STM32H753)
  const fcGroup = new THREE.Group();
  fcGroup.position.y = 8;
  const fcPcbGeo = new THREE.BoxGeometry(36, 1.8, 36);
  const fcPcb = new THREE.Mesh(fcPcbGeo, pcbMat);
  fcGroup.add(fcPcb);

  // STM32H7 Microcontroller IC Package (QFP100)
  const mcuGeo = new THREE.BoxGeometry(14, 1.2, 14);
  const mcu = new THREE.Mesh(mcuGeo, darkMetalMat);
  mcu.position.y = 1.4;
  fcGroup.add(mcu);

  // Side-mounted USB-C programming port
  const usbGeo = new THREE.BoxGeometry(8, 3.2, 6);
  const usb = new THREE.Mesh(usbGeo, aluminumMat);
  usb.position.set(17, 1.2, 0);
  fcGroup.add(usb);

  // Dual IMU vibration damping silicone grommets (at 4 corners)
  [-15.25, 15.25].forEach(dx => {
    [-15.25, 15.25].forEach(dz => {
      const grommetGeo = new THREE.CylinderGeometry(2.5, 2.5, 7, 12);
      const grommet = new THREE.Mesh(grommetGeo, damperMat);
      grommet.position.set(dx, -2, dz);
      fcGroup.add(grommet);
    });
  });

  // Diagnostic LEDs on Flight Controller (ARM/DISARM, GPS FIX, SYS FAULT)
  const ledArm = new THREE.Mesh(new THREE.SphereGeometry(1.4, 10, 10), ledGreenMat);
  ledArm.position.set(12, 2.0, 12);
  fcGroup.add(ledArm);

  const ledGps = new THREE.Mesh(new THREE.SphereGeometry(1.4, 10, 10), ledBlueMat);
  ledGps.position.set(8, 2.0, 12);
  fcGroup.add(ledGps);

  const ledFault = new THREE.Mesh(new THREE.SphereGeometry(1.4, 10, 10), ledRedMat);
  ledFault.position.set(4, 2.0, 12);
  fcGroup.add(ledFault);

  avionicsGroup.add(fcGroup);
  chassisGroup.add(avionicsGroup);

  // -------------------------------------------------------------
  // 3. FOLDING GPS / COMPASS MAST MODULE
  // -------------------------------------------------------------
  const gpsMastGroup = new THREE.Group();
  gpsMastGroup.position.set(0, 14, 0);
  gpsMastGroup.userData = { instanceId: 'DRONE-GPS-001', partId: 'PART-GPS-001' };

  // Aluminum Base Mount with folding hinge
  const gpsBaseGeo = new THREE.CylinderGeometry(8, 10, 5, 16);
  const gpsBase = new THREE.Mesh(gpsBaseGeo, aluminumMat);
  gpsMastGroup.add(gpsBase);

  // Carbon Fiber Mast Rod (75mm elevation to avoid electromagnetic motor noise)
  const gpsRodGeo = new THREE.CylinderGeometry(2.5, 2.5, 65, 12);
  const gpsRod = new THREE.Mesh(gpsRodGeo, carbonMat);
  gpsRod.position.y = 35;
  gpsMastGroup.add(gpsRod);

  // Ceramic GNSS / Compass Antenna Saucer Dome
  const gpsDomeGeo = new THREE.CylinderGeometry(20, 20, 7, 32);
  const gpsDome = new THREE.Mesh(gpsDomeGeo, darkMetalMat);
  gpsDome.position.y = 68;
  gpsMastGroup.add(gpsDome);

  // Direction arrow indicator atop GPS puck
  const gpsArrowGeo = new THREE.ConeGeometry(4, 8, 3);
  const gpsArrow = new THREE.Mesh(gpsArrowGeo, ledGreenMat);
  gpsArrow.rotation.x = Math.PI / 2;
  gpsArrow.position.set(0, 72, 8);
  gpsMastGroup.add(gpsArrow);

  group.add(gpsMastGroup);

  // -------------------------------------------------------------
  // 4. 6S 4500MAH LIPO BATTERY PACK & POWER HARNESS
  // -------------------------------------------------------------
  const batteryGroup = new THREE.Group();
  batteryGroup.position.set(0, -28, 0);
  batteryGroup.userData = { instanceId: 'DRONE-BATTERY-001', partId: 'PART-BATTERY-001' };

  // Main 6-Cell Battery Pack (with reinforced fiber tape)
  const batteryGeo = new THREE.BoxGeometry(68, 32, 42);
  const batteryMesh = new THREE.Mesh(batteryGeo, lipoPackMat);
  batteryGroup.add(batteryMesh);

  // High-C Discharge Warning & Rating Label
  const labelGeo = new THREE.PlaneGeometry(54, 20);
  const label = new THREE.Mesh(labelGeo, lipoLabelMat);
  label.rotation.x = Math.PI / 2;
  label.position.y = -16.1;
  batteryGroup.add(label);

  // Heavy-Duty 10AWG Silicone Power Cables (Red + Black)
  const cableRedCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(26, 0, 8),
    new THREE.Vector3(38, 10, 8),
    new THREE.Vector3(42, 22, 6)
  ]);
  const cableRed = new THREE.Mesh(new THREE.TubeGeometry(cableRedCurve, 16, 2.2, 10, false), siliconeRedMat);
  batteryGroup.add(cableRed);

  const cableBlackCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(26, 0, -8),
    new THREE.Vector3(38, 10, -8),
    new THREE.Vector3(42, 22, -6)
  ]);
  const cableBlack = new THREE.Mesh(new THREE.TubeGeometry(cableBlackCurve, 16, 2.2, 10, false), siliconeBlackMat);
  batteryGroup.add(cableBlack);

  // Authentic Yellow XT60 Anti-Spark Female Connector
  const xt60Geo = new THREE.BoxGeometry(8, 16, 15);
  const xt60 = new THREE.Mesh(xt60Geo, xt60YellowMat);
  xt60.position.set(44, 24, 0);
  batteryGroup.add(xt60);

  group.add(batteryGroup);

  // -------------------------------------------------------------
  // 5. 3-AXIS STABILIZED CAMERA GIMBAL WITH SILICONE DAMPERS
  // -------------------------------------------------------------
  const gimbalGroup = new THREE.Group();
  gimbalGroup.position.set(0, -20, 20);
  gimbalGroup.userData = { instanceId: 'DRONE-PAYLOAD-ASSY' };

  // Upper Gimbal Mounting Plate
  const gimbalTopGeo = new THREE.BoxGeometry(32, 2.5, 32);
  const gimbalTop = new THREE.Mesh(gimbalTopGeo, carbonMat);
  gimbalGroup.add(gimbalTop);

  // 4x Anti-vibration Blue Silicone Damper Spheres
  [-11, 11].forEach(gx => {
    [-11, 11].forEach(gz => {
      const damperGeo = new THREE.SphereGeometry(3.5, 14, 14);
      const damper = new THREE.Mesh(damperGeo, damperMat);
      damper.position.set(gx, -5, gz);
      gimbalGroup.add(damper);
    });
  });

  // Lower Suspended Gimbal Plate
  const gimbalBtmGeo = new THREE.BoxGeometry(32, 2.5, 32);
  const gimbalBtm = new THREE.Mesh(gimbalBtmGeo, carbonMat);
  gimbalBtm.position.y = -10;
  gimbalGroup.add(gimbalBtm);

  // Yaw Brushless Gimbal Motor
  const yawMotorGeo = new THREE.CylinderGeometry(8, 8, 10, 20);
  const yawMotor = new THREE.Mesh(yawMotorGeo, aluminumMat);
  yawMotor.position.y = -16;
  gimbalGroup.add(yawMotor);

  // 4K Optical Sensor Camera Body
  const cameraBodyGeo = new THREE.BoxGeometry(26, 22, 20);
  const cameraBody = new THREE.Mesh(cameraBodyGeo, darkMetalMat);
  cameraBody.position.set(0, -28, 4);
  cameraBody.userData = { instanceId: 'DRONE-CAMERA-001', partId: 'PART-CAMERA-001' };
  gimbalGroup.add(cameraBody);

  // Multi-Element Optical Barrel & Blue Anti-Reflective Lens
  const lensBarrelGeo = new THREE.CylinderGeometry(9, 9, 12, 24);
  const lensBarrel = new THREE.Mesh(lensBarrelGeo, aluminumMat);
  lensBarrel.rotation.x = Math.PI / 2;
  lensBarrel.position.set(0, -28, 18);
  gimbalGroup.add(lensBarrel);

  const lensGlassGeo = new THREE.CircleGeometry(7.8, 24);
  const lensGlass = new THREE.Mesh(lensGlassGeo, cameraLensMat);
  lensGlass.position.set(0, -28, 24.1);
  gimbalGroup.add(lensGlass);

  group.add(gimbalGroup);

  // -------------------------------------------------------------
  // 6. CARBON FIBER LANDING GEAR WITH SKIS & CLAMPS
  // -------------------------------------------------------------
  const landingGearGroup = new THREE.Group();
  landingGearGroup.userData = { instanceId: 'DRONE-CHASSIS-001' };
  const landingStruts: THREE.Group[] = [];

  [-1, 1].forEach(sideX => {
    const sideLegGroup = new THREE.Group();
    sideLegGroup.position.x = sideX * 42;

    // Dual Angled Struts (Front & Rear)
    [-24, 24].forEach(strutZ => {
      const strutGeo = new THREE.CylinderGeometry(4.2, 3.8, 72, 16);
      const strut = new THREE.Mesh(strutGeo, carbonMat);
      strut.position.set(sideX * 10, -42, strutZ);
      strut.rotation.z = -sideX * 0.28;
      sideLegGroup.add(strut);

      // Aluminum CNC attachment clamp to bottom deck
      const clampGeo = new THREE.BoxGeometry(10, 8, 10);
      const clamp = new THREE.Mesh(clampGeo, aluminumMat);
      clamp.position.set(0, -12, strutZ);
      sideLegGroup.add(clamp);
    });

    // Horizontal Aluminum Ski Tube (190mm length with end plugs)
    const skiGeo = new THREE.CylinderGeometry(5.5, 5.5, 190, 20);
    const ski = new THREE.Mesh(skiGeo, aluminumMat);
    ski.rotation.x = Math.PI / 2;
    ski.position.set(sideX * 22, -76, 0);
    sideLegGroup.add(ski);

    // Rubber Anti-Slip End Plugs
    [-95, 95].forEach(endZ => {
      const plugGeo = new THREE.SphereGeometry(6, 14, 14);
      const plug = new THREE.Mesh(plugGeo, darkMetalMat);
      plug.position.set(sideX * 22, -76, endZ);
      sideLegGroup.add(plug);
    });

    landingGearGroup.add(sideLegGroup);
    landingStruts.push(sideLegGroup);
  });
  group.add(landingGearGroup);

  // -------------------------------------------------------------
  // 7. 4X QUADCOPTER ARMS, MOTOR BOLTS, ESCS & COUNTER-ROTORS
  // -------------------------------------------------------------
  const armAngles = [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4];
  const armSuffixes = ['FR', 'FL', 'RL', 'RR'];
  const armsGroup = new THREE.Group();
  armsGroup.userData = { instanceId: 'DRONE-STRUCTURAL-ASSY' };

  const armSubGroups: THREE.Group[] = [];
  const rotorGroups: THREE.Group[] = [];
  const motorAssemblies: THREE.Group[] = [];
  const motorScrewGroups: THREE.Group[] = [];
  const propNutGroups: THREE.Group[] = [];

  armAngles.forEach((angle, idx) => {
    const suffix = armSuffixes[idx];
    const armInstanceId = `DRONE-ARM-${suffix}-001`;
    const motorInstanceId = `DRONE-MOTOR-${suffix}-001`;
    const propInstanceId = `DRONE-PROP-${suffix}-001`;

    const armSubGroup = new THREE.Group();
    armSubGroup.userData = { instanceId: armInstanceId };
    const armLength = 165;

    // 1. Carbon Fiber Tube Arm (Ø16mm outer, hollow interior)
    const tubeGeo = new THREE.CylinderGeometry(8, 8, armLength, 24);
    const tube = new THREE.Mesh(tubeGeo, carbonMat);
    tube.rotation.z = Math.PI / 2;
    tube.position.x = armLength / 2;
    tube.userData = { instanceId: armInstanceId, partId: `PART-ARM-${suffix}-001` };
    armSubGroup.add(tube);

    // Inner Chassis Arm Clamp (CNC Aluminum dual-clamp block with 2 bolts)
    const innerClampGeo = new THREE.BoxGeometry(16, 20, 22);
    const innerClamp = new THREE.Mesh(innerClampGeo, aluminumMat);
    innerClamp.position.x = 42;
    armSubGroup.add(innerClamp);

    [-6, 6].forEach(boltZ => {
      const clampBolt = createM3Screw(22, 2.5, 2.0);
      clampBolt.position.set(42, 11, boltZ);
      armSubGroup.add(clampBolt);
    });

    // 2. Electronic Speed Controller (ESC) on Arm
    const escGroup = new THREE.Group();
    escGroup.position.set(85, 9, 0);

    // ESC Circuit Board + Heat Spreader
    const escPcbGeo = new THREE.BoxGeometry(32, 4, 15);
    const escPcb = new THREE.Mesh(escPcbGeo, darkMetalMat);
    escGroup.add(escPcb);

    const escFinGeo = new THREE.BoxGeometry(26, 2, 13);
    const escFin = new THREE.Mesh(escFinGeo, aluminumMat);
    escFin.position.y = 2.8;
    escGroup.add(escFin);

    // 3 Motor Lead Wires exiting ESC toward motor
    [-3, 0, 3].forEach(wireZ => {
      const wireCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(16, 0, wireZ),
        new THREE.Vector3(45, 0, wireZ * 1.5),
        new THREE.Vector3(75, 5, wireZ * 0.8)
      ]);
      const wire = new THREE.Mesh(new THREE.TubeGeometry(wireCurve, 12, 1.0, 8, false), darkMetalMat);
      escGroup.add(wire);
    });
    armSubGroup.add(escGroup);

    // 3. Outer Motor Mount Aluminum Clamp Plate
    const motorMountClampGeo = new THREE.CylinderGeometry(17, 17, 8, 24);
    const motorMountClamp = new THREE.Mesh(motorMountClampGeo, aluminumMat);
    motorMountClamp.position.set(armLength, 0, 0);
    motorMountClamp.userData = { instanceId: armInstanceId, partId: `PART-ARM-${suffix}-001` };
    armSubGroup.add(motorMountClamp);

    // 4. Brushless Outrunner Motor Assembly (2212 920KV)
    const motorAssy = new THREE.Group();
    motorAssy.position.set(armLength, 5, 0);
    motorAssy.userData = { instanceId: motorInstanceId, partId: `PART-MOTOR-${suffix}-001` };

    // Motor Stator Base Plate (with 19x16mm M3 threaded holes)
    const statorBaseGeo = new THREE.CylinderGeometry(15, 16, 4, 24);
    const statorBase = new THREE.Mesh(statorBaseGeo, darkMetalMat);
    motorAssy.add(statorBase);

    // Copper Windings Stator Core (12 stator teeth)
    const windingsGeo = new THREE.CylinderGeometry(13.5, 13.5, 13, 16);
    const windings = new THREE.Mesh(windingsGeo, copperMat);
    windings.position.y = 8;
    motorAssy.add(windings);

    // Outer Rotating Rotor Bell (with CNC cooling vents)
    const bellGeo = new THREE.CylinderGeometry(16.5, 16.5, 18, 32);
    const bell = new THREE.Mesh(bellGeo, darkMetalMat);
    bell.position.y = 12;
    motorAssy.add(bell);

    // Anodized Motor Bell Rim Accent Ring
    const rimGeo = new THREE.TorusGeometry(16.5, 0.9, 12, 32);
    const rim = new THREE.Mesh(rimGeo, aluminumMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 21;
    motorAssy.add(rim);

    // Stainless Steel 5mm Threaded Propeller Shaft
    const shaftGeo = new THREE.CylinderGeometry(2.5, 2.5, 34, 16);
    const shaft = new THREE.Mesh(shaftGeo, aluminumMat);
    shaft.position.y = 22;
    motorAssy.add(shaft);

    armSubGroup.add(motorAssy);
    motorAssemblies.push(motorAssy);

    // 5. 4x M3 Screws securing Motor from underneath through the arm clamp
    const motorScrews = new THREE.Group();
    motorScrews.position.set(armLength, -4, 0);
    [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].forEach(scrAngle => {
      const scrRadius = 9.5;
      const mScr = createM3Screw(6, 2.4, 1.8);
      mScr.rotation.x = Math.PI; // Screws point upward into motor base
      mScr.position.set(Math.cos(scrAngle) * scrRadius, 0, Math.sin(scrAngle) * scrRadius);
      motorScrews.add(mScr);
    });
    armSubGroup.add(motorScrews);
    motorScrewGroups.push(motorScrews);

    // 6. Rotating Propeller Rotor & Flanged Locknut Group
    const rotorGroup = new THREE.Group();
    rotorGroup.position.set(armLength, 28, 0);
    rotorGroup.userData = { instanceId: propInstanceId, partId: `PART-PROP-${suffix}-001` };

    // Central Propeller Hub with counter-bore
    const propHubGeo = new THREE.CylinderGeometry(9, 9, 8, 24);
    const propHub = new THREE.Mesh(propHubGeo, propMat);
    rotorGroup.add(propHub);

    // Aerodynamic Dual Rotor Blades (10x4.5 inch Carbon Composite with cambered twist)
    [-1, 1].forEach(bladeDir => {
      const bladeCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(bladeDir * 8, 0, 0),
        new THREE.Vector3(bladeDir * 45, 1.5, bladeDir * 1.8),
        new THREE.Vector3(bladeDir * 85, 2.8, bladeDir * 3.5),
        new THREE.Vector3(bladeDir * 125, 1.2, bladeDir * 4.2),
        new THREE.Vector3(bladeDir * 140, 0, bladeDir * 3.0)
      ]);
      const bladeGeo = new THREE.TubeGeometry(bladeCurve, 20, 3.8, 12, false);
      const blade = new THREE.Mesh(bladeGeo, propMat);
      blade.scale.set(1, 0.45, 1.8); // Flatten into aerodynamic airfoil profile
      blade.userData = { instanceId: propInstanceId, partId: `PART-PROP-${suffix}-001` };
      rotorGroup.add(blade);
    });

    armSubGroup.add(rotorGroup);
    rotorGroups.push(rotorGroup);

    // Flanged M6 Self-Locking Propeller Nut
    const propNutGroup = new THREE.Group();
    propNutGroup.position.set(armLength, 34, 0);
    const nutFlangeGeo = new THREE.CylinderGeometry(8, 8, 2, 16);
    const nutFlange = new THREE.Mesh(nutFlangeGeo, aluminumMat);
    propNutGroup.add(nutFlange);

    const nutHexGeo = new THREE.CylinderGeometry(5.5, 5.5, 7, 6);
    const nutHex = new THREE.Mesh(nutHexGeo, aluminumMat);
    nutHex.position.y = 4.5;
    propNutGroup.add(nutHex);

    armSubGroup.add(propNutGroup);
    propNutGroups.push(propNutGroup);

    armSubGroup.rotation.y = angle;
    armsGroup.add(armSubGroup);
    armSubGroups.push(armSubGroup);
  });

  group.add(armsGroup);
  group.add(chassisGroup);

  let currentPropAngle = 0;

  return {
    group,
    updateOpenAngle: (angleDeg: number) => {
      // Rotate propellers continuously according to counter-rotating quad physics
      currentPropAngle += (angleDeg + 12) * 0.06;
      rotorGroups.forEach((r, i) => {
        // Rotors: FL and RR spin CCW (+), FR and RL spin CW (-)
        const isCW = (i === 1 || i === 2);
        r.rotation.y = isCW ? -currentPropAngle : currentPropAngle;
      });
    },
    // True Mechanical CAD Exploded Disassembly (0% -> 100% / Step-by-Step Disassembly)
    updateExplode: (f: number) => {
      // 1. Fasteners & Locknuts fly off first along top Z
      propNutGroups.forEach(nut => {
        nut.position.y = 34 + f * 140;
      });

      // 2. Propellers slide upward off motor shafts
      rotorGroups.forEach(rotor => {
        rotor.position.y = 28 + f * 95;
      });

      // 3. Motors lift upward off arm clamps
      motorAssemblies.forEach(motor => {
        motor.position.y = 5 + f * 55;
      });

      // 4. Motor bottom M3 screws drop downward
      motorScrewGroups.forEach(screws => {
        screws.position.y = -4 - f * 45;
      });

      // 5. GPS mast rises high above the drone
      gpsMastGroup.position.y = 14 + f * 180;

      // 6. Top deck M3 screws lift high
      topScrewsGroup.position.y = f * 130;

      // 7. Top carbon deck plate elevates
      topPlateGroup.position.y = 12 + f * 75;

      // 8. Flight controller and avionics stack floats upward between plates
      fcGroup.position.y = 8 + f * 105;
      pdbGroup.position.y = -4 + f * 45;

      // 9. Knurled aluminum standoffs expand radially outward
      standoffMeshes.forEach((st, i) => {
        const ang = (i / 6) * Math.PI * 2;
        const rad = 50 + f * 40;
        st.position.set(Math.cos(ang) * rad, 0, Math.sin(ang) * rad);
      });

      // 10. Bottom deck M3 screws drop straight downward
      bottomScrewsGroup.position.y = -f * 130;

      // 11. Bottom carbon deck plate drops downward
      bottomPlateGroup.position.y = -12 - f * 60;

      // 12. Carbon fiber arms expand outward along their 45° diagonal vectors
      armSubGroups.forEach((arm, i) => {
        const ang = armAngles[i];
        arm.position.x = Math.cos(ang) * f * 75;
        arm.position.z = Math.sin(ang) * f * 75;
      });

      // 13. 6S LiPo battery pack drops downward
      batteryGroup.position.y = -28 - f * 105;

      // 14. 3-Axis Camera gimbal drops downward with lens
      gimbalGroup.position.y = -20 - f * 145;

      // 15. Landing gear drops downward and skids splay outward
      landingGearGroup.position.y = -f * 115;
      landingStruts.forEach((strut, i) => {
        const side = i === 0 ? -1 : 1;
        strut.position.x = side * (42 + f * 35);
      });
    }
  };
}

export function buildSolidWorksBallValve(config: ValveConfig, wireframe: boolean = false): { 
  group: THREE.Group; 
  updateOpenAngle: (angle: number) => void;
  updateExplode: (factor: number) => void;
} {
  const isDrone = config.valveType === 'INDUSTRIAL_DRONE' || config.valveType === 'QUADCOPTER';
  const isFaucet = config.valveType === 'GOOSENECK_FAUCET';
  
  if (isDrone) {
    return buildIndustrialQuadcopterDrone(config, wireframe);
  }

  const group = new THREE.Group();
  const getMaterial = (color: number, metalness = 0.8, roughness = 0.2) => {
    return new THREE.MeshStandardMaterial({
      color,
      metalness,
      roughness,
      wireframe,
      envMapIntensity: 1.2
    });
  };

  const matColor = config.material === 'BRASS' || config.material === 'GOLD' || config.material === 'CAST_BRONZE' ? 0xeab308 : 
                   config.material === 'CHROME' || config.material === 'STAINLESS_STEEL' || config.material === 'CHROME_PLATED' || config.material === 'STAINLESS_316' ? 0xe2e8f0 : 0xa16207;
  
  const bodyMat = getMaterial(matColor, 0.9, 0.15);
  const accentMat = getMaterial(0x334155, 0.5, 0.4);
  const handleMat = getMaterial(new THREE.Color(config.handleColor || '#eab308').getHex(), 0.7, 0.3);

  if (isFaucet) {
    // ---------------------------------------------------------
    // HIGH-FIDELITY GOOSENECK FAUCET (SolidWorks Professional)
    // ---------------------------------------------------------
    
    // 1. Deck Plate (Escutcheon)
    const plateGeo = new THREE.CylinderGeometry(45, 48, 6, 48);
    const plate = new THREE.Mesh(plateGeo, bodyMat);
    plate.position.y = -77;
    group.add(plate);

    // 2. Main Column Base (Tapered Hub)
    const baseGeo = new THREE.CylinderGeometry(22, 28, 40, 48);
    const base = new THREE.Mesh(baseGeo, bodyMat);
    base.position.y = -54;
    group.add(base);

    // 3. Middle Collar (Design Accent)
    const collarGeo = new THREE.TorusGeometry(23, 3, 24, 64);
    const collar = new THREE.Mesh(collarGeo, accentMat);
    collar.rotation.x = Math.PI / 2;
    collar.position.y = -35;
    group.add(collar);

    // 4. Upper Pillar (Stem)
    const stemGeo = new THREE.CylinderGeometry(18, 22, 60, 48);
    const stem = new THREE.Mesh(stemGeo, bodyMat);
    stem.position.y = -5;
    group.add(stem);

    // 5. Professional Gooseneck (Bezier Curve Tube)
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 25, 0),
      new THREE.Vector3(0, 100, 0),
      new THREE.Vector3(20, 140, 0),
      new THREE.Vector3(80, 150, 0),
      new THREE.Vector3(130, 120, 0),
      new THREE.Vector3(140, 80, 0),
    ]);
    
    const neckGeo = new THREE.TubeGeometry(curve, 100, 12, 32, false);
    const neck = new THREE.Mesh(neckGeo, bodyMat);
    group.add(neck);

    // 6. Professional Aerator / Nozzle Head
    const nozzleGroup = new THREE.Group();
    nozzleGroup.position.set(140, 80, 0);
    
    const headGeo = new THREE.CylinderGeometry(14, 18, 25, 32);
    const head = new THREE.Mesh(headGeo, bodyMat);
    nozzleGroup.add(head);

    const tipGeo = new THREE.CylinderGeometry(18, 16, 8, 32);
    const tip = new THREE.Mesh(tipGeo, accentMat);
    tip.position.y = -14;
    nozzleGroup.add(tip);

    const aeratorGeo = new THREE.CircleGeometry(14, 32);
    const aerator = new THREE.Mesh(aeratorGeo, new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.2 }));
    aerator.rotation.x = Math.PI / 2;
    aerator.position.y = -18.1;
    nozzleGroup.add(aerator);

    group.add(nozzleGroup);

    // 7. High-End Side Lever Handle
    const handleGroup = new THREE.Group();
    handleGroup.position.set(30, -30, 0);

    const pivotGeo = new THREE.SphereGeometry(12, 32, 32);
    const pivot = new THREE.Mesh(pivotGeo, bodyMat);
    handleGroup.add(pivot);

    const leverStemGeo = new THREE.CylinderGeometry(4, 6, 15, 16);
    const leverStem = new THREE.Mesh(leverStemGeo, bodyMat);
    leverStem.position.x = 12;
    leverStem.rotation.z = -Math.PI / 2;
    handleGroup.add(leverStem);

    const gripGeo = new THREE.CapsuleGeometry(5, 45, 16, 32);
    const grip = new THREE.Mesh(gripGeo, handleMat);
    grip.position.set(45, 15, 0);
    grip.rotation.z = -0.4;
    handleGroup.add(grip);

    group.add(handleGroup);

    // 8. Dynamic Water Flow
    let water: THREE.Mesh | null = null;
    if (config.showWaterFlow) {
      const waterGeo = new THREE.CylinderGeometry(8, 6, 200, 16);
      const waterMat = new THREE.MeshStandardMaterial({ 
        color: 0x60a5fa, 
        transparent: true, 
        opacity: 0.6,
        roughness: 0,
        metalness: 0.1
      });
      water = new THREE.Mesh(waterGeo, waterMat);
      water.position.set(140, -20, 0);
      group.add(water);
    }

    return {
      group,
      updateOpenAngle: (angle: number) => {
        handleGroup.rotation.x = (angle / 90) * 0.8;
        if (water) {
          water.visible = angle > 5;
          water.scale.x = water.scale.z = (angle / 90);
          water.material.opacity = (angle / 90) * 0.6;
        }
      },
      updateExplode: (f: number) => {
        nozzleGroup.position.y = 80 + f * 100;
        plate.position.y = -77 - f * 50;
        handleGroup.position.x = 30 + f * 80;
      }
    };

  } else {
    // ---------------------------------------------------------
    // INDUSTRIAL BALL VALVE (SolidWorks Professional)
    // ---------------------------------------------------------
    
    const bodyHubGeo = new THREE.SphereGeometry(35, 32, 32);
    const bodyHub = new THREE.Mesh(bodyHubGeo, bodyMat);
    group.add(bodyHub);

    const inletGroup = new THREE.Group();
    [-1, 1].forEach(side => {
      const pipeGeo = new THREE.CylinderGeometry(22, 22, 50, 32);
      const pipe = new THREE.Mesh(pipeGeo, bodyMat);
      pipe.rotation.z = Math.PI / 2;
      pipe.position.x = side * 45;
      inletGroup.add(pipe);

      const flangeGeo = new THREE.CylinderGeometry(40, 40, 10, 32);
      const flange = new THREE.Mesh(flangeGeo, bodyMat);
      flange.rotation.z = Math.PI / 2;
      flange.position.x = side * 70;
      inletGroup.add(flange);
      
      for (let i = 0; i < 8; i++) {
        const boltGeo = new THREE.CylinderGeometry(3, 3, 12, 12);
        const bolt = new THREE.Mesh(boltGeo, accentMat);
        const ang = (i / 8) * Math.PI * 2;
        bolt.rotation.z = Math.PI / 2;
        bolt.position.set(side * 70, Math.cos(ang) * 30, Math.sin(ang) * 30);
        inletGroup.add(bolt);
      }
    });
    group.add(inletGroup);

    const bonnetGeo = new THREE.CylinderGeometry(18, 25, 30, 32);
    const bonnet = new THREE.Mesh(bonnetGeo, bodyMat);
    bonnet.position.y = 35;
    group.add(bonnet);

    const handleGroup = new THREE.Group();
    handleGroup.position.y = 55;

    const hubGeo = new THREE.CylinderGeometry(12, 12, 10, 32);
    const hub = new THREE.Mesh(hubGeo, bodyMat);
    handleGroup.add(hub);

    const leverGeo = new THREE.BoxGeometry(160, 6, 25);
    const lever = new THREE.Mesh(leverGeo, handleMat);
    lever.position.x = 60;
    handleGroup.add(lever);
    
    const gripGeo = new THREE.CapsuleGeometry(14, 40, 16, 32);
    const grip = new THREE.Mesh(gripGeo, new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 }));
    grip.rotation.z = Math.PI / 2;
    grip.position.x = 140;
    handleGroup.add(grip);

    group.add(handleGroup);

    return {
      group,
      updateOpenAngle: (angle: number) => {
        handleGroup.rotation.y = (angle / 90) * (Math.PI / 2);
      },
      updateExplode: (f: number) => {
        handleGroup.position.y = 55 + f * 100;
        inletGroup.position.x = f * 50;
      }
    };
  }
}
