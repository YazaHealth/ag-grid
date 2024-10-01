import type { _ExcelExportGridApi } from 'ag-grid-community';
import { CsvExportCoreModule, ModuleNames } from 'ag-grid-community';

import { EnterpriseCoreModule } from '../agGridEnterpriseModule';
import { defineEnterpriseModule } from '../moduleUtils';
import { ExcelCreator } from './excelCreator';
import {
    exportDataAsExcel,
    exportMultipleSheetsAsExcel,
    getDataAsExcel,
    getMultipleSheetsAsExcel,
    getSheetDataForExcel,
} from './excelExportApi';

export const ExcelExportCoreModule = defineEnterpriseModule('ExcelExportCoreModule', {
    beans: [ExcelCreator],
    dependsOn: [CsvExportCoreModule, EnterpriseCoreModule],
});

export const ExcelExportApiModule = defineEnterpriseModule<_ExcelExportGridApi>('ExcelExportApiModule', {
    apiFunctions: {
        getDataAsExcel,
        exportDataAsExcel,
        getSheetDataForExcel,
        getMultipleSheetsAsExcel,
        exportMultipleSheetsAsExcel,
    },
    dependsOn: [ExcelExportCoreModule],
});

export const ExcelExportModule = defineEnterpriseModule(ModuleNames.ExcelExportModule, {
    dependsOn: [ExcelExportCoreModule, ExcelExportApiModule],
});
