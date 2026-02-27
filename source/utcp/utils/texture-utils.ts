
import { IProperty } from '@cocos/creator-types/editor/packages/scene/@types/public';

export class TextureUtils {
    static readonly FilterModeMap: Record<string, { minfilter: string; magfilter: string; mipfilter: string }> = {
        'Nearest (None)': { minfilter: 'nearest', magfilter: 'nearest', mipfilter: 'none' },
        'Bilinear': { minfilter: 'linear', magfilter: 'linear', mipfilter: 'none' },
        'Bilinear with Mipmaps': { minfilter: 'linear', magfilter: 'linear', mipfilter: 'nearest' },
        'Trilinear with Mipmaps': { minfilter: 'linear', magfilter: 'linear', mipfilter: 'linear' },
    };

    static readonly WrapModeMap: Record<string, { wrapModeS: string; wrapModeT: string }> = {
        'Repeat': { wrapModeS: 'repeat', wrapModeT: 'repeat' },
        'Clamp': { wrapModeS: 'clamp-to-edge', wrapModeT: 'clamp-to-edge' },
        'Mirror': { wrapModeS: 'mirrored-repeat', wrapModeT: 'mirrored-repeat' },
    };

    /**
     * Applies synthetic texture properties (filterMode, wrapMode) to the user data.
     * Returns true if the property was handled.
     */
    static applyProperties(userData: any, path: string, value: any): boolean {
        if (path === 'filterMode') {
            if (this.FilterModeMap[value]) {
                Object.assign(userData, this.FilterModeMap[value]);
                return true;
            }
        } else if (path === 'wrapMode') {
            if (this.WrapModeMap[value]) {
                Object.assign(userData, this.WrapModeMap[value]);
                return true;
            }
        }
        return false;
    }

    /**
     * Injects synthetic texture properties (filterMode, wrapMode) into the property container.
     */
    static injectTextureProperties(userData: any, propertyContainer: { [key: string]: IProperty }): void {
        // Filter Mode Logic
        let filterMode = 'Advanced';
        for (const [mode, settings] of Object.entries(this.FilterModeMap)) {
            if (userData.minfilter === settings.minfilter &&
                userData.magfilter === settings.magfilter &&
                userData.mipfilter === settings.mipfilter) {
                filterMode = mode;
                break;
            }
        }

        propertyContainer.filterMode = {
            value: filterMode,
            type: 'Enum',
            enumList: [...Object.keys(this.FilterModeMap), 'Advanced'].map(k => ({ name: k, value: k })),
            displayName: 'Filter Mode',
        };

        if (filterMode === 'Advanced') {
            propertyContainer.minfilter = { 
                value: userData.minfilter, 
                type: 'Enum',
                enumList: ['nearest', 'linear'].map(k => ({ name: k, value: k })),
                displayName: 'Min Filter',
            };
            propertyContainer.magfilter = { 
                value: userData.magfilter, 
                type: 'Enum',
                enumList: ['nearest', 'linear'].map(k => ({ name: k, value: k })),
                displayName: 'Mag Filter',
            };
            propertyContainer.mipfilter = { 
                value: userData.mipfilter, 
                type: 'Enum',
                enumList: ['none', 'nearest', 'linear'].map(k => ({ name: k, value: k })),
                displayName: 'Mip Filter',
            };
        }

        // Wrap Mode Logic
        let wrapMode = 'Advanced';
        for (const [mode, settings] of Object.entries(this.WrapModeMap)) {
            if (userData.wrapModeS === settings.wrapModeS &&
                userData.wrapModeT === settings.wrapModeT) {
                wrapMode = mode;
                break;
            }
        }

        propertyContainer.wrapMode = {
            value: wrapMode,
            type: 'Enum',
            enumList: [...Object.keys(this.WrapModeMap), 'Advanced'].map(k => ({ name: k, value: k })),
            displayName: 'Wrap Mode',
        };

         if (wrapMode === 'Advanced') {
            const wrapModes = ['repeat', 'clamp-to-edge', 'mirrored-repeat'].map(k => ({ name: k, value: k }));
            propertyContainer.wrapModeS = { 
                value: userData.wrapModeS, 
                type: 'Enum',
                enumList: wrapModes,
                displayName: 'Wrap Mode S',
            };
            propertyContainer.wrapModeT = { 
                value: userData.wrapModeT, 
                type: 'Enum',
                enumList: wrapModes,
                displayName: 'Wrap Mode T',
            };
        }

        propertyContainer.anisotropy = {
            value: userData.anisotropy,
            type: 'Number',
            displayName: 'Anisotropy',
        };
    }
}
