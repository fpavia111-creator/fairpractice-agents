#!/usr/bin/env node
import { fileURLToPath } from 'node:url';
import { main } from 'fairpractice-core';
import { manifest } from '../src/manifest.js';
import { demo } from '../src/demo.js';

main(manifest, { bin: 'fairpractice-therapy-billing', demo, evalFile: fileURLToPath(new URL('../evals/cases.json', import.meta.url)) });
