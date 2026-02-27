import { IAssetInfo } from "@cocos/creator-types/editor/packages/asset-db/@types/public";
import { IPropertyValueType } from '@cocos/creator-types/editor/packages/scene/@types/public';

export interface IAssetImporter {
    /**
     * The importer name this handler supports (e.g. 'material', 'texture', 'typescript')
     */
    name: string;

    /**
     * The "Fake" Class Name for this importer (e.g. 'MaterialAssetImporter')
     */
    className: string;

    /**
     * Returns the actual properties of the asset, conforming to the definition
     * @param assetInfo The asset info object from asset-db
     */
    getProperties(assetInfo: IAssetInfo): Promise<{ [key: string]: IPropertyValueType }>;

    /**
     * Sets a property on the asset
     * @param assetInfo The asset info object from asset-db
     * @param path The path of the property to set
     * @param value The value to set
     */
    setProperty(assetInfo: IAssetInfo, path: string, value: any): Promise<boolean>;
}

export abstract class BaseAssetImporter implements IAssetImporter {
    abstract name: string;
    
    get className(): string {
        // Default: Capitalize name + AssetImporter (e.g. image -> ImageAssetImporter)
        return this.name.charAt(0).toUpperCase() + this.name.slice(1) + 'AssetImporter';
    }

    abstract getProperties(assetInfo: IAssetInfo): Promise<{ [key: string]: IPropertyValueType }>;

    async setProperty(assetInfo: IAssetInfo, path: string, value: any): Promise<boolean> {
        console.warn(`[BaseAssetImporter] setProperty not implemented for ${this.name}`);
        return false;
    }
}

