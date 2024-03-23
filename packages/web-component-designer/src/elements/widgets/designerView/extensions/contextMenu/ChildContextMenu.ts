import { IContextMenuItem } from '../../../../helper/contextMenu/IContextMenuItem.js';
import { IDesignItem } from '../../../../item/IDesignItem.js';
import { IDesignerCanvas } from '../../IDesignerCanvas.js';
import { ContextmenuInitiator, IContextMenuExtension } from './IContextMenuExtension.js';

export class ChildContextMenu implements IContextMenuExtension {
    private _title: string;
    private _contextMenus: IContextMenuExtension[];

    constructor(title: string, ...contextMenus: IContextMenuExtension[]) {
        this._title = title;
        this._contextMenus = contextMenus;
    }
    public shouldProvideContextmenu(event: MouseEvent, designerView: IDesignerCanvas, designItem: IDesignItem, initiator: ContextmenuInitiator) {
        return this._contextMenus.some(x => x.shouldProvideContextmenu(event, designerView, designItem, initiator));
    }

    public provideContextMenuItems(event: MouseEvent, designerView: IDesignerCanvas, designItem: IDesignItem): IContextMenuItem[] {
        return [{ title: this._title, children: this._contextMenus.map(x => x.provideContextMenuItems(event, designerView, designItem)).flat() }];
    }
}