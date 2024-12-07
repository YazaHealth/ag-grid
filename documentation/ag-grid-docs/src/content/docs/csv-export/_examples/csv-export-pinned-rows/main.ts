import type { GridApi, GridOptions } from 'ag-grid-community';
import {
    AllCommunityModule,
    ClientSideRowModelModule,
    CsvExportModule,
    ModuleRegistry,
    createGrid,
} from 'ag-grid-community';
import { ColumnMenuModule, ContextMenuModule } from 'ag-grid-enterprise';

ModuleRegistry.registerModules([
    AllCommunityModule,
    ClientSideRowModelModule,
    CsvExportModule,
    ColumnMenuModule,
    ContextMenuModule,
]);

let gridApi: GridApi;

const gridOptions: GridOptions = {
    defaultColDef: {
        editable: true,
        minWidth: 100,
        flex: 1,
    },

    suppressExcelExport: true,
    popupParent: document.body,

    columnDefs: [{ field: 'make' }, { field: 'model' }, { field: 'price' }],

    pinnedTopRowData: [{ make: 'Top Make', model: 'Top Model', price: 0 }],

    pinnedBottomRowData: [{ make: 'Bottom Make', model: 'Bottom Model', price: 10101010 }],

    rowData: [
        { make: 'Toyota', model: 'Celica', price: 35000 },
        { make: 'Ford', model: 'Mondeo', price: 32000 },
        { make: 'Porsche', model: 'Boxster', price: 72000 },
    ],
};

function getBoolean(id: string) {
    const field: any = document.querySelector('#' + id);

    return !!field.checked;
}

function getParams() {
    return {
        skipPinnedTop: getBoolean('skipPinnedTop'),
        skipPinnedBottom: getBoolean('skipPinnedBottom'),
    };
}

function onBtnExport() {
    gridApi!.exportDataAsCsv(getParams());
}

function onBtnUpdate() {
    (document.querySelector('#csvResult') as any).value = gridApi!.getDataAsCsv(getParams());
}

// setup the grid after the page has finished loading
document.addEventListener('DOMContentLoaded', function () {
    const gridDiv = document.querySelector<HTMLElement>('#myGrid')!;
    gridApi = createGrid(gridDiv, gridOptions);
});
