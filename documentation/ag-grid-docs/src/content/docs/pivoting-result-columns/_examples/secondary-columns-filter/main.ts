import type { GridApi, GridOptions } from 'ag-grid-community';
import { AllCommunityModule, ClientSideRowModelModule, ModuleRegistry, createGrid } from 'ag-grid-community';
import {
    ColumnMenuModule,
    ContextMenuModule,
    FiltersToolPanelModule,
    PivotModule,
    SetFilterModule,
} from 'ag-grid-enterprise';

ModuleRegistry.registerModules([
    AllCommunityModule,
    ClientSideRowModelModule,
    FiltersToolPanelModule,
    ColumnMenuModule,
    ContextMenuModule,
    PivotModule,
    SetFilterModule,
]);

let gridApi: GridApi<IOlympicData>;

const gridOptions: GridOptions<IOlympicData> = {
    columnDefs: [
        { field: 'country', rowGroup: true },
        { field: 'athlete', rowGroup: true },
        { field: 'year', pivot: true },
        { field: 'gold', aggFunc: 'sum', filter: 'agNumberColumnFilter' },
        { field: 'silver', aggFunc: 'sum', filter: 'agNumberColumnFilter' },
        { field: 'bronze', aggFunc: 'sum', filter: 'agNumberColumnFilter' },
    ],
    defaultColDef: {
        flex: 1,
        minWidth: 130,
        floatingFilter: true,
    },
    autoGroupColumnDef: {
        minWidth: 200,
    },
    pivotMode: true,
};

// setup the grid after the page has finished loading
document.addEventListener('DOMContentLoaded', function () {
    const gridDiv = document.querySelector<HTMLElement>('#myGrid')!;
    gridApi = createGrid(gridDiv, gridOptions);

    fetch('https://www.ag-grid.com/example-assets/small-olympic-winners.json')
        .then((response) => response.json())
        .then((data: IOlympicData[]) => gridApi!.setGridOption('rowData', data));
});
