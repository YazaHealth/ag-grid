import type { _CsvExportGridApi } from '../api/gridApi';
import { defineCommunityModule } from '../interfaces/iModule';
import { ModuleNames } from '../modules/moduleNames';
import { CsvCreator } from './csvCreator';
import { exportDataAsCsv, getDataAsCsv } from './csvExportApi';
import { GridSerializer } from './gridSerializer';

export const CsvExportCoreModule = defineCommunityModule('CsvExportCoreModule', {
    beans: [CsvCreator, GridSerializer],
});

export const CsvExportApiModule = defineCommunityModule<_CsvExportGridApi>('CsvExportApiModule', {
    apiFunctions: {
        getDataAsCsv,
        exportDataAsCsv,
    },
    dependsOn: [CsvExportCoreModule],
});

export const CsvExportModule = defineCommunityModule(ModuleNames.CsvExportModule, {
    dependsOn: [CsvExportCoreModule, CsvExportApiModule],
});
