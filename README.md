# Krishna Particle Effect

A creative web experiment using **Three.js** to render a 3D model of Krishna through an animated, rim-focused particle system.

## Overview
This project processes a `.glb` 3D model to extract surface geometry, then filters those vertices to display only the "rim" (edges relative to the camera). These points are then rendered with custom GLSL shaders to create a fluid, glowing particle aesthetic.

## Features
* **Custom Rim Shader:** Uses vertex and fragment shader manipulation to highlight model edges.
* **Procedural Animation:** Particles exhibit a shifting, organic motion using trigonometric functions.
* **Dynamic Background:** A large, slowly rotating star-field created with additive blending.
* **Responsive Design:** Automatically adjusts to browser window resizing.

## Requirements
* **Model File:** You must have a file named `krishna.glb` in your project root directory.
* **Environment:** A local web server is required to load the model (e.g., VS Code's "Live Server" extension, `npx serve`, or Python's `http.server`).

## Technical Stack
* **Library:** [Three.js (r136)](https://threejs.org/)
* **Format:** `GLTFLoader` for mesh data extraction.
* **Graphics:** WebGL with custom `onBeforeCompile` shader modifications.

## Usage
1. Clone the repository.
2. Ensure your `krishna.glb` file is correctly placed.
3. Serve the directory using a local development server.
4. Open the site in any modern web browser.

---
*Built with Three.js*
