import { CustomTooltipProps } from '@ag-grid-community/react';
import React, { useMemo } from 'react';

export default (props: CustomTooltipProps & { type: string }) => {

    const data = useMemo(() => props.api.getDisplayedRowAtIndex(props.rowIndex!)!.data, []);

    return (
        <div className="custom-tooltip">
            <div className={'panel panel-' + (props.type || 'primary')}>
                <div className="panel-heading">
                    <h3 className="panel-title">{data.country}</h3>
                </div>
                <div className="panel-body">
                    <h4 style={{ whiteSpace: 'nowrap' }}>{data.athlete}</h4>
                    <p>Total: {data.total}</p>
                </div>
            </div>
        </div>
    );
};
