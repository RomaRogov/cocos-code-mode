import { IAssetImporter } from './base-importer';

export class ImporterManager {
    private static _instance: ImporterManager;
    private _importers: Map<string, IAssetImporter> = new Map();

    public static getInstance(): ImporterManager {
        if (!this._instance) {
            this._instance = new ImporterManager();
        }
        return this._instance;
    }

    private constructor() {}

    public registerImporter(importer: IAssetImporter) {
        this._importers.set(importer.name, importer);
    }

    public getImporter(name: string): IAssetImporter | undefined {
        return this._importers.get(name);
    }

    public hasImporter(name: string): boolean {
        return this._importers.has(name);
    }
}
