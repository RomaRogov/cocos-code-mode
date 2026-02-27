import { readFileSync } from 'fs';
import { join } from 'path';

const templateRaw = readFileSync(join(__dirname, '../../../static/template/preview/index.html'), 'utf-8');
const styleRaw = readFileSync(join(__dirname, '../../../static/style/preview/index.css'), 'utf-8');

module.exports = Editor.Panel.define({
    template: templateRaw,
    style: styleRaw,
    $: {
        container: '#preview-container',
    },
    
    listeners: {
    },
    
    methods: {
        async generatePreview(uuid: string, width: number = 512, height: number = 512, jpegQuality: number = 80): Promise<string> {
            try {
                const info = await Editor.Message.request('asset-db', 'query-asset-info', uuid);
                if (!info) throw new Error("Asset info not found");
    
                let previewType = '';
                let queryMethod = '';
                
                switch (info.importer) {
                    case 'prefab':
                    case 'fbx':
                    case 'gltf':
                    case 'gltf-skeleton':
                        previewType = 'scene:prefab-preview';
                        queryMethod = 'query-prefab-preview-data';
                        break;
                    case 'material':
                        previewType = 'scene:material-preview';
                        queryMethod = 'query-material-preview-data';
                        break;
                    case 'gltf-mesh':
                    case 'mesh':
                        previewType = 'scene:mesh-preview';
                        queryMethod = 'query-mesh-preview-data';
                        break;
                    case 'spine':
                        previewType = 'scene:spine-preview';
                        queryMethod = 'query-spine-preview-data';
                        break;
                    default:
                        previewType = 'scene:mini-preview';
                        queryMethod = 'query-scene-preview-data';
                        break;
                }
                
                // @ts-ignore
                const GLPreview = Editor._Module.require('PreviewExtends').default;
                const glPreview = new GLPreview(previewType, queryMethod);
                
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                
                await glPreview.init({ width, height });
                await glPreview.initGL(canvas, { width, height });
                await glPreview.resizeGL(width, height);
    
                // Set Target
                const call = async (func: string, ...args: any[]) => { 
                    return await Editor.Message.request('scene', 'call-preview-function', previewType, func, ...args); 
                };
    
                if (info.importer === 'prefab' || info.importer === 'scene' || info.importer === 'fbx' || info.importer === 'gltf') {
                    await call('setPrefab', uuid);
                } else if (info.importer === 'material') {
                    // Match Inspector implementation
                    await call('resetCamera');
                    await call('setLightEnable', true);
                    await call('setPrimitive', 'sphere');
                    await Editor.Message.request('scene', 'preview-material', uuid);
                } else if (info.importer === 'gltf-mesh') {
                    await call('setModel', uuid);
                } else if (info.importer === 'spine') {
                    await call('setSpine', uuid);
                } else {
                     await call('setScene', uuid);
                }
    
                // Draw
                const data = await glPreview.queryPreviewData({ width, height });
                
                glPreview.drawGL(data);
    
                const dataURL = canvas.toDataURL('image/jpeg', jpegQuality);

                return dataURL.replace(/^data:image\/\w+;base64,/, '');
    
            } catch (error: any) {
                console.error(`[Preview] Error:`, error);
                throw new Error(`Generaton failed: ${error.message}`);
            }
        },
    }
} as any);
