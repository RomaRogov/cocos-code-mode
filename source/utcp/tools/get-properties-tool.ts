import { utcpTool } from '../decorators';
import { IInstanceReference, InstanceReferenceSchema } from '../schemas';
import { ToolsUtils } from '../utils/tools-utils';

export class GetPropertiesTool {

    @utcpTool(
        "inspectorGetSettingsProperties",
        "Gets plain object of properties for the specific settings.",
        { type: 'object', properties: { settingsType: { type: 'string', enum: ['CurrentSceneGlobals', 'ProjectSettings'] } }, required: ['settingsType'] },
        { type: 'object', properties: { dump: { type: 'object' } }, required: ['dump'] }, "GET",  ['inspect', 'scene', 'properties', 'settings', 'config', 'dump']
    )
    async inspectorGetSettingsProperties(params: { settingsType: string }): Promise<any> {
        return await this.inspectorGetProperties({ reference: { id: params.settingsType } });
    }

    @utcpTool(
        "inspectorGetInstanceProperties",
        "Gets plain object of properties, with no serialization info for any instance (scene node, component, asset).",
        { type: 'object', properties: { reference: InstanceReferenceSchema }, required: ['reference'] },
        { type: 'object', properties: { dump: { type: 'object' } }, required: ['dump'] }, "GET",  ['inspect', 'properties', 'dump', 'instance', 'node', 'component', 'asset', 'data']
    )
    async inspectorGetProperties(args: { reference: IInstanceReference }): Promise<{ dump: any }> {
        const info = await ToolsUtils.inspectInstance(args.reference.id);
        if (!info) {
            throw new Error(`Target ${args.reference.id} not found or not supported.`);
        }

        const { props, type, assetInfo } = info;
        if (!props) {
            throw new Error(`Could not retrieve properties for ${type} (${args.reference.id}).`);
        }

        const parsedProps = ToolsUtils.unwrapProperties(props);

        return { dump: parsedProps };
    }
}

