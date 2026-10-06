import {defineConfig} from 'vite';
export default defineConfig({base:process.env.GITHUB_PAGES?'/gun-wizards/':'/',build:{rollupOptions:{output:{manualChunks:{three:['three','three/addons/loaders/GLTFLoader.js','three/addons/utils/SkeletonUtils.js'],network:['spacetimedb']}}}}});
