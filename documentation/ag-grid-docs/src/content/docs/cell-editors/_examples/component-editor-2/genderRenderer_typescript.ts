import { ICellRendererComp, ICellRendererParams } from '@ag-grid-community/core';

export class GenderRenderer implements ICellRendererComp {
    eGui!: HTMLSpanElement;
    init(params: ICellRendererParams) {
        this.eGui = document.createElement('span');
        if (params.value) {
            const icon = params.value === 'Male' ? 'fa-male' : 'fa-female';
            this.eGui.innerHTML = `<i class="fa ${icon}"></i> ${params.value}`;
        }
    }

    getGui() {
        return this.eGui;
    }
    refresh(params: ICellRendererParams): boolean {
        return false;
    }
}
