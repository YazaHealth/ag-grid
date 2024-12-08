import type { ColDef, GridApi, GridOptions } from 'ag-grid-community';
import {
    ClientSideRowModelModule,
    ModuleRegistry,
    PaginationModule,
    RowSelectionModule,
    ValidationModule,
    createGrid,
} from 'ag-grid-community';

ModuleRegistry.registerModules([
    RowSelectionModule,
    PaginationModule,
    ClientSideRowModelModule,
    ValidationModule /* Development Only */
]);

const columnDefs: ColDef[] = [
    {
        field: 'athlete',
        minWidth: 170,
    },
    { field: 'age' },
    { field: 'country' },
    { field: 'year' },
    { field: 'date' },
    { field: 'sport' },
    { field: 'gold' },
    { field: 'silver' },
    { field: 'bronze' },
    { field: 'total' },
];

let gridApi: GridApi<IOlympicData>;

const gridOptions: GridOptions<IOlympicData> = {
    defaultColDef: {
        editable: true,
        filter: true,
        flex: 1,
        minWidth: 100,
    },
    rowSelection: {
        mode: 'multiRow',
        groupSelects: 'descendants',
    },
    columnDefs,
    pagination: true,
};

// setup the grid after the page has finished loading
document.addEventListener('DOMContentLoaded', function () {
    const gridDiv = document.querySelector<HTMLElement>('#myGrid')!;
    gridApi = createGrid(gridDiv, gridOptions);

    fetch('https://www.ag-grid.com/example-assets/olympic-winners.json')
        .then((response) => response.json())
        .then((data: IOlympicData[]) => gridApi!.setGridOption('rowData', data));
});
