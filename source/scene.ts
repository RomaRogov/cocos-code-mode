export function load() { }
export function unload() { }
let _originalConsoleError: (...data: unknown[]) => void = () => { };
let _caughtLogs: string[] = [];

export const methods = {
    async startCatchLogging() {
        _caughtLogs = [];
        _originalConsoleError = console.error;
        console.error = (...data: unknown[]) => {
            const msg = data.map(a => a instanceof Error ? a.message : a).join(' ');
            _caughtLogs.push(msg);
            _originalConsoleError(...data);
        }
    },

    async stopCatchLogging(): Promise<string[]> {
        console.error = _originalConsoleError;
        return _caughtLogs;
    },

    async createPrefabFromNode(nodeUuid: string, path: string): Promise<string> {
        const cce = (globalThis as any)['cce'];
        
        if (!cce || !cce.Prefab || !cce.Prefab.createPrefabAssetFromNode) {
            throw new Error('CCE API not found');
        }

        return await cce.Prefab.createPrefabAssetFromNode(nodeUuid, path);
    },

    async applyPrefabByNode(nodeUuid: string): Promise<string | null> {
        try {
            const cce = (globalThis as any)['cce'];
            if (!cce || !cce.Prefab || !cce.Prefab.applyPrefab) {
                throw new Error('CCE API not found');
            }

            const success: boolean = await cce.Prefab.applyPrefab(nodeUuid);
            if (!success) {
                throw new Error('Failed to apply prefab');
            } else {
                return null;
            }
        } catch (error) {
            return error instanceof Error ? error.message : String(error);
        }
    },

    async unlinkPrefabByNode(nodeUuid: string, recursive: boolean): Promise<string | null> {
        try {
            const cce = (globalThis as any)['cce'];
            if (!cce || !cce.Prefab || !cce.Prefab.unWrapPrefabInstance) {
                throw new Error('CCE API not found');
            }

            const success: boolean = await cce.Prefab.unWrapPrefabInstance(nodeUuid, recursive);
            if (!success) {
                throw new Error('Failed to unlink prefab');
            } else {
                return null;
            }
        } catch (error) {
             return error instanceof Error ? error.message : String(error);
        }
    },

    async createOffscreenCanvas(width: number, height: number): Promise<HTMLCanvasElement> {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        return canvas;
    },

    async captureScreenshot(
        imageSize: { width: number, height: number } = { width: 512, height: 512 }, 
        jpegQuality: number = 80,
        cameraPosition?: { x: number, y: number, z: number },
        targetPosition?: { x: number, y: number, z: number },
        orthographic: boolean = false,
        orthographicSize: number = 10
    ): Promise<string> {
        return new Promise((resolve, reject) => {
            const cce = (globalThis as any)['cce'];
            const cc = (globalThis as any)['cc'];

            let prevWidth: number;
            let prevHeight: number;

            // Optional: Save camera state
            let prevCamPos: any;
            let prevCamRot: any;
            let prevProjection: number;
            let prevOrthoSize: number;
            
            // Apply Camera Changes
            try {
                if (cce && cce.Camera && cce.Camera.camera) {
                    const camNode = cce.Camera.camera.node;

                    if (camNode) {
                        prevCamPos = camNode.position.clone();
                        prevCamRot = camNode.rotation.clone();
                        prevProjection = cce.Camera.camera.projection;
                        prevOrthoSize = cce.Camera.camera.orthoSize;

                        cce.Camera.camera.projection = orthographic ? 
                            cc.Camera.ProjectionType.ORTHO : cc.Camera.ProjectionType.PERSPECTIVE;

                        if (orthographic) {
                            cce.Camera.camera.orthoSize = orthographicSize;
                        }

                        if (cameraPosition) {
                            camNode.setPosition(new cc.Vec3(cameraPosition.x ?? 0, cameraPosition.y ?? 0, cameraPosition.z ?? 0));
                        }
                        if (targetPosition) {
                            camNode.lookAt(new cc.Vec3(targetPosition.x ?? 0, targetPosition.y ?? 0, targetPosition.z ?? 0));
                        }
                        
                        if (cce.Camera.refresh) cce.Camera.refresh();
                    }
                }
            } catch (e) {
                console.warn("[captureScreenshot] Failed to modify camera:", e);
            }

            if (cc.director && cc.director.root) {
                prevWidth = cc.director.root.mainWindow?.width || 0;
                prevHeight = cc.director.root.mainWindow?.height || 0;
                cc.director.root.resize(imageSize.width, imageSize.height);
            } else {
                return reject(new Error("cc.game.canvas not found or is not an HTMLCanvasElement"));
            }
            
            try {
                if (cce && cce.Engine) {
                    cce.Engine.repaintInEditMode();
                }
            } catch (e) { console.warn("Failed to repaintInEditMode:", e); }

            cc.director.once(cc.Director.EVENT_AFTER_RENDER, () => {
                try {
                    if (cc.game && cc.game.canvas && (cc.game.canvas instanceof HTMLCanvasElement)) {
                        const dataURL = cc.game.canvas.toDataURL('image/jpeg', jpegQuality / 100);
                        const base64 = dataURL.replace(/^data:image\/\w+;base64,/, '');
                        resolve(base64);
                    } else {
                        reject(new Error("cc.game.canvas not found or is not an HTMLCanvasElement"));
                    }
                } catch (error: any) {
                     reject(new Error(error.message || String(error)));
                } finally {
                    // Restore previous size
                    if (cc.director && cc.director.root) {
                        cc.director.root.resize(prevWidth, prevHeight);
                    }
                    // Restore camera
                    setTimeout(() => {
                        if (cce && cce.Camera && cce.Camera.camera && cce.Camera.camera.node) {
                            if (prevCamPos) cce.Camera.camera.node.setPosition(prevCamPos);
                            if (prevCamRot) cce.Camera.camera.node.setRotation(prevCamRot);
                            if (prevProjection !== undefined) cce.Camera.camera.projection = prevProjection;
                            if (prevOrthoSize !== undefined) cce.Camera.camera.orthoSize = prevOrthoSize;
                            if (cce.Camera.refresh) cce.Camera.refresh();
                        }
                    }, 50);
                }
            });
        });
    }
};
