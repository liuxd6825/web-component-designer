import { IContentChanged } from "../../../../index.js";
import { DesignItem } from "../../../item/DesignItem";
import { IDesignItem } from "../../../item/IDesignItem";
import { NodeType } from "../../../item/NodeType.js";
import { ISelectionChangedEvent } from "../../../services/selectionService/ISelectionChangedEvent";
import { IDesignerCanvas } from "../IDesignerCanvas";
import { ExtensionType } from './ExtensionType';
import { IExtensionManager } from "./IExtensionManger";

export class ExtensionManager implements IExtensionManager {

  designerCanvas: IDesignerCanvas;
  designItemsWithExtentions: Set<IDesignItem> = new Set();

  constructor(designerCanvas: IDesignerCanvas) {
    this.designerCanvas = designerCanvas;

    designerCanvas.instanceServiceContainer.selectionService.onSelectionChanged.on(this._selectedElementsChanged.bind(this));
    designerCanvas.instanceServiceContainer.contentService.onContentChanged.on(this._contentChanged.bind(this));
  }

  private _contentChanged(contentChanged: IContentChanged) {
    requestAnimationFrame(() => {
      switch (contentChanged.changeType) {
        case 'added':
          this.applyExtensions(contentChanged.designItems, ExtensionType.Permanent, true);
          break;
        case 'moved':
          this.refreshExtensions(contentChanged.designItems, ExtensionType.Permanent);
          break;
        case 'parsed':
          this.applyExtensions(Array.from(this.designerCanvas.rootDesignItem.children()), ExtensionType.Permanent, true);
          break;
        case 'removed':
          this.removeExtensions(contentChanged.designItems, ExtensionType.Permanent);
          break;
      }
    });
  }

  private _selectedElementsChanged(selectionChangedEvent: ISelectionChangedEvent) {
    if (selectionChangedEvent.oldSelectedElements && selectionChangedEvent.oldSelectedElements.length) {
      if (selectionChangedEvent.oldSelectedElements[0].parent) {
        const primaryContainer = DesignItem.GetOrCreateDesignItem(selectionChangedEvent.oldSelectedElements[0].parent.element, this.designerCanvas.serviceContainer, this.designerCanvas.instanceServiceContainer)
        this.removeExtension(primaryContainer, ExtensionType.PrimarySelectionContainer);
        this.removeExtension(selectionChangedEvent.oldSelectedElements[0], ExtensionType.PrimarySelection);
        this.removeExtensions(selectionChangedEvent.oldSelectedElements, ExtensionType.Selection);
      }
    }
    if (selectionChangedEvent.selectedElements && selectionChangedEvent.selectedElements.length) {
      this.applyExtensions(selectionChangedEvent.selectedElements, ExtensionType.Selection);
      this.applyExtension(selectionChangedEvent.selectedElements[0], ExtensionType.PrimarySelection);
      const primaryContainer = DesignItem.GetOrCreateDesignItem(selectionChangedEvent.selectedElements[0].parent.element, this.designerCanvas.serviceContainer, this.designerCanvas.instanceServiceContainer)
      this.applyExtension(primaryContainer, ExtensionType.PrimarySelectionContainer);
    }

    this.refreshExtensions(selectionChangedEvent.selectedElements);
  }

  applyExtension(designItem: IDesignItem, extensionType: ExtensionType, recursive: boolean = false) {
    if (designItem && designItem.nodeType == NodeType.Element) {
      const extProv = this.designerCanvas.serviceContainer.designerExtensions.get(extensionType);
      if (extProv) {
        for (let e of extProv) {
          if (e.shouldExtend(this, this.designerCanvas, designItem)) {
            let appE = designItem.appliedDesignerExtensions.get(extensionType);
            if (!appE)
              appE = [];
            const ext = e.getExtension(this, this.designerCanvas, designItem);
            try {
              ext.extend();
            }
            catch (err) {
              console.error(err);
            }
            appE.push(ext);
            designItem.appliedDesignerExtensions.set(extensionType, appE);
            this.designItemsWithExtentions.add(designItem);
          }
        }
      }

      if (recursive) {
        for (const d of designItem.children()) {
          this.applyExtension(d, extensionType, recursive);
        }
      }
    }
  }

  applyExtensions(designItems: IDesignItem[], extensionType: ExtensionType, recursive: boolean = false) {
    if (designItems) {
      const extProv = this.designerCanvas.serviceContainer.designerExtensions.get(extensionType);
      if (extProv) {
        for (let e of extProv) {
          for (let i of designItems) {
            if (i.nodeType == NodeType.Element && e.shouldExtend(this, this.designerCanvas, i)) {
              let appE = i.appliedDesignerExtensions.get(extensionType);
              if (!appE)
                appE = [];
              const ext = e.getExtension(this, this.designerCanvas, i);
              try {
                ext.extend();
              }
              catch (err) {
                console.error(err);
              }
              appE.push(ext);
              i.appliedDesignerExtensions.set(extensionType, appE);
              this.designItemsWithExtentions.add(i);
            }
          }
        }
      }

      if (recursive) {
        for (const d of designItems) {
          this.applyExtensions(Array.from(d.children()), extensionType, recursive);
        }
      }
    }
  }

  removeExtension(designItem: IDesignItem, extensionType?: ExtensionType) {
    if (designItem) {
      if (extensionType) {
        let exts = designItem.appliedDesignerExtensions.get(extensionType);
        if (exts) {
          for (let e of exts) {
            try {
              e.dispose();
            }
            catch (err) {
              console.error(err);
            }
          }
          designItem.appliedDesignerExtensions.delete(extensionType);
          if (!designItem.appliedDesignerExtensions.size)
            this.designItemsWithExtentions.delete(designItem);
        }
      } else {
        for (let appE of designItem.appliedDesignerExtensions) {
          for (let e of appE[1]) {
            try {
              e.dispose();
            }
            catch (err) {
              console.error(err);
            }
          }
        }
        designItem.appliedDesignerExtensions.clear();
        this.designItemsWithExtentions.delete(designItem);

      }
    }
  }

  removeExtensions(designItems: IDesignItem[], extensionType?: ExtensionType) {
    if (designItems) {
      if (extensionType) {
        for (let i of designItems) {
          let exts = i.appliedDesignerExtensions.get(extensionType);
          if (exts) {
            for (let e of exts) {
              try {
                e.dispose();
              }
              catch (err) {
                console.error(err);
              }
            }
            i.appliedDesignerExtensions.delete(extensionType);
            if (!i.appliedDesignerExtensions.size)
              this.designItemsWithExtentions.delete(i);
          }
        }
      } else {
        for (let i of designItems) {
          for (let appE of i.appliedDesignerExtensions) {
            for (let e of appE[1]) {
              try {
                e.dispose();
              }
              catch (err) {
                console.error(err);
              }
            }
          }
          i.appliedDesignerExtensions.clear();
          this.designItemsWithExtentions.delete(i);

        }
      }
    }
  }

  refreshExtension(designItem: IDesignItem, extensionType?: ExtensionType) {
    if (designItem) {
      if (extensionType) {
        let exts = designItem.appliedDesignerExtensions.get(extensionType);
        if (exts) {
          for (let e of exts) {
            try {
              e.refresh();
            }
            catch (err) {
              console.error(err);
            }
          }
        }
      } else {
        for (let appE of designItem.appliedDesignerExtensions) {
          for (let e of appE[1]) {
            try {
              e.refresh();
            }
            catch (err) {
              console.error(err);
            }
          }
        }
      }
    }
  }

  refreshExtensions(designItems: IDesignItem[], extensionType?: ExtensionType, ignoredExtension?: any) {
    if (designItems) {
      if (extensionType) {
        for (let i of designItems) {
          let exts = i.appliedDesignerExtensions.get(extensionType);
          if (exts) {
            for (let e of exts) {
              try {
                if (e != ignoredExtension)
                  e.refresh();
              }
              catch (err) {
                console.error(err);
              }
            }
          }
        }
      } else {
        for (let i of designItems) {
          for (let appE of i.appliedDesignerExtensions) {
            for (let e of appE[1]) {
              try {
                if (e != ignoredExtension)
                  e.refresh();
              }
              catch (err) {
                console.error(err);
              }
            }
          }
        }
      }
    }
  }

  refreshAllExtensions(designItems: IDesignItem[], ignoredExtension?: any) {
    if (designItems) {
      this.refreshExtensions(designItems, ExtensionType.Permanent, ignoredExtension);
      this.refreshExtensions(designItems, ExtensionType.Selection, ignoredExtension);
      this.refreshExtensions(designItems, ExtensionType.PrimarySelection, ignoredExtension);
      this.refreshExtensions(designItems, ExtensionType.PrimarySelectionContainer, ignoredExtension);
      this.refreshExtensions(designItems, ExtensionType.MouseOver, ignoredExtension);
      this.refreshExtensions(designItems, ExtensionType.OnlyOneItemSelected, ignoredExtension);
      this.refreshExtensions(designItems, ExtensionType.MultipleItemsSelected, ignoredExtension);
      this.refreshExtensions(designItems, ExtensionType.ContainerDragOver, ignoredExtension);
      this.refreshExtensions(designItems, ExtensionType.ContainerDrag, ignoredExtension);
      this.refreshExtensions(designItems, ExtensionType.Doubleclick, ignoredExtension);
    }
  }

  refreshAllAppliedExtentions() {
    this.refreshAllExtensions([...this.designItemsWithExtentions])
  }
}
