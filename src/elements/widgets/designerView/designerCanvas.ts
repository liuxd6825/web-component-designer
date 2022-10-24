import { EventNames } from "../../../enums/EventNames";
import { ServiceContainer } from '../../services/ServiceContainer';
import { IElementDefinition } from '../../services/elementsService/IElementDefinition';
import { InstanceServiceContainer } from '../../services/InstanceServiceContainer';
import { UndoService } from '../../services/undoService/UndoService';
import { SelectionService } from '../../services/selectionService/SelectionService';
import { DesignItem } from '../../item/DesignItem';
import { IDesignItem } from '../../item/IDesignItem';
import { BaseCustomWebComponentLazyAppend, css, html, TypedEvent, cssFromString } from '@node-projects/base-custom-webcomponent';
import { dragDropFormatNameElementDefinition, dragDropFormatNameBindingObject } from '../../../Constants';
import { ContentService } from '../../services/contentService/ContentService';
import { InsertAction } from '../../services/undoService/transactionItems/InsertAction';
import { IDesignerCanvas } from './IDesignerCanvas';
import { Snaplines } from './Snaplines';
import { IPlacementView } from './IPlacementView';
import { DeleteAction } from '../../services/undoService/transactionItems/DeleteAction';
import { CommandType } from '../../../commandHandling/CommandType';
import { IUiCommandHandler } from '../../../commandHandling/IUiCommandHandler';
import { IUiCommand } from '../../../commandHandling/IUiCommand';
import { DefaultHtmlParserService } from "../../services/htmlParserService/DefaultHtmlParserService";
import { ExtensionType } from "./extensions/ExtensionType";
import { IExtensionManager } from "./extensions/IExtensionManger";
import { ExtensionManager } from "./extensions/ExtensionManager";
import { NamedTools } from "./tools/NamedTools";
import { Screenshot } from '../../helper/Screenshot';
import { dataURItoBlob, exportData, sleep } from "../../helper/Helper";
import { IContextMenuItem } from "../../helper/contextMenu/IContextMenuItem";
import { DomHelper } from '@node-projects/base-custom-webcomponent/dist/DomHelper';
import { IPoint } from "../../../interfaces/IPoint";
import { OverlayLayer } from "./extensions/OverlayLayer";
import { OverlayLayerView } from './overlayLayerView';
import { IDesignerPointerExtension } from './extensions/pointerExtensions/IDesignerPointerExtension';
import { IRect } from "../../../interfaces/IRect.js";
import { ISize } from "../../../interfaces/ISize.js";
import { ITool } from "./tools/ITool.js";
import { IPlacementService } from "../../services/placementService/IPlacementService.js";
import { ContextMenu } from "../../helper/contextMenu/ContextMenu";

export class DesignerCanvas extends BaseCustomWebComponentLazyAppend implements IDesignerCanvas, IPlacementView, IUiCommandHandler {
  // Public Properties
  public serviceContainer: ServiceContainer;
  public instanceServiceContainer: InstanceServiceContainer;
  public containerBoundingRect: DOMRect;
  public outerRect: DOMRect;
  public clickOverlay: HTMLDivElement;

  private _activeTool: ITool;

  // IPlacementView
  public gridSize = 10;
  public alignOnGrid = false;
  public alignOnSnap = true;
  public snapLines: Snaplines;
  public overlayLayer: OverlayLayerView;
  public rootDesignItem: IDesignItem;
  public eatEvents: Element;
  public transformHelperElement: HTMLDivElement;

  private _zoomFactor = 1; //if scale or zoom css property is used this needs to be the value
  private _scaleFactor = 1; //if scale css property is used this need to be the scale value
  private _canvasOffset: IPoint = { x: 0, y: 0 };

  private _currentContextMenu: ContextMenu
  private _backgroundImage: string;

  public get zoomFactor(): number {
    return this._zoomFactor;
  }
  public set zoomFactor(value: number) {
    this._zoomFactor = value;
    this._zoomFactorChanged();
  }
  public get scaleFactor(): number {
    return this._scaleFactor;
  }
  public get canvasOffset(): IPoint {
    return this._canvasOffset;
  }
  public set canvasOffset(value: IPoint) {
    this._canvasOffset = value;
    this._zoomFactorChanged(false);
  }
  public get canvasOffsetUnzoomed(): IPoint {
    return { x: this._canvasOffset.x * this.zoomFactor, y: this._canvasOffset.y * this.zoomFactor };
  }
  public set canvasOffsetUnzoomed(value: IPoint) {
    this.canvasOffset = { x: value.x / this.zoomFactor, y: value.y / this.zoomFactor };
  }

  public onContentChanged = new TypedEvent<void>();
  public onZoomFactorChanged = new TypedEvent<number>();

  // Private Variables
  private _canvas: HTMLDivElement;
  private _canvasContainer: HTMLDivElement;
  private _outercanvas2: HTMLDivElement;

  private _lastHoverDesignItem: IDesignItem;

  private _pointerEventHandlerBound: (event: PointerEvent) => void;

  private _firstConnect: boolean;

  private _onKeyDownBound: any;
  private _onKeyUpBound: any;

  static override readonly style = css`
    :host {
      display: block;
      box-sizing: border-box;
      width: 100%;
      position: relative;
      transform: translateZ(0);
      overflow: hidden;

      font-family: initial;
      font-size: initial;
      font-weight: initial;
      font-style: initial;
      line-height: initial;
    }
    * {
      touch-action: none;
    }
    #node-projects-designer-canvas-canvas {
      background-color: var(--canvas-background, white);
      /* 10px grid, using http://www.patternify.com/ */
      background-image: url(data:image/png;base64,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);
      background-position: 0px 0px;
      box-sizing: border-box;
      width: 100%;
      height: 100%;
      transform-origin: 0 0;
    }

    #node-projects-designer-canvas-canvas.dragFileActive {
      outline: blue 4px solid;
      outline-offset: -4px;
    }

    node-projects-overlay-layer-view {
      box-sizing: border-box;
      width: 100%;
      height: 100%;
      position: absolute;
      top: 0;
      left: 0;
      pointer-events: none;
      overflow: visible;
      user-select: none;
      -webkit-user-select: none;
      z-index: 999999999999;
    }
    
    #node-projects-designer-canvas-canvas * {
      cursor: pointer;
      user-select: none;
      -webkit-user-select: none;
    }

    #node-projects-designer-canvas-clickOverlay {
      position: absolute;
      width: 100%;
      height: 100%;
      top: 0;
    }
    
    #node-projects-designer-canvas-transformHelper {
      height: 0;
      width: 0;
    }`;

  static override readonly template = html`
    <div style="display: flex;flex-direction: column;width: 100%;height: 100%;">
      <div style="width: 100%;height: 100%;">
        <div id="node-projects-designer-canvas-outercanvas2" style="width:100%;height:100%;position:relative;">
          <div id="node-projects-designer-canvas-canvasContainer"
            style="width: 100%;height: 100%;position: absolute;top: 0;left: 0;user-select: none;">
            <div id="node-projects-designer-canvas-canvas" part="canvas"></div>
          </div>
        </div>
        <div id="node-projects-designer-canvas-clickOverlay" tabindex="0" style="pointer-events: auto;"></div>
      </div>
      <div id="node-projects-designer-canvas-transformHelper"></div>
    </div>`;

  public extensionManager: IExtensionManager;
  private _pointerextensions: IDesignerPointerExtension[];
  private _onDblClickBound: any;

  constructor() {
    super();
    this._restoreCachedInititalValues();

    this._canvas = this._getDomElement<HTMLDivElement>('node-projects-designer-canvas-canvas');
    this._canvasContainer = this._getDomElement<HTMLDivElement>('node-projects-designer-canvas-canvasContainer');
    this._outercanvas2 = this._getDomElement<HTMLDivElement>('node-projects-designer-canvas-outercanvas2');
    this.clickOverlay = this._getDomElement<HTMLDivElement>('node-projects-designer-canvas-clickOverlay');
    this.transformHelperElement = this._getDomElement<HTMLDivElement>('node-projects-designer-canvas-transformHelper');

    this._onKeyDownBound = this.onKeyDown.bind(this);
    this._onKeyUpBound = this.onKeyUp.bind(this);
    this._onDblClickBound = this._onDblClick.bind(this);
    this._pointerEventHandlerBound = this._pointerEventHandler.bind(this);

    this.clickOverlay.oncontextmenu = (e) => e.preventDefault();
  }

  get designerWidth(): string {
    return this._canvasContainer.style.width;
  }
  set designerWidth(value: string) {
    this._canvasContainer.style.width = value;
    this._zoomFactorChanged();
  }
  get designerHeight(): string {
    return this._canvasContainer.style.height;
  }
  set designerHeight(value: string) {
    this._canvasContainer.style.height = value;
    this._zoomFactorChanged();
  }

  getDesignSurfaceDimensions(): ISize {
    let ret: ISize = { width: null, height: null };
    const cs = getComputedStyle(this._canvasContainer);
    if (this._canvasContainer.style.width)
      ret.width = parseFloat(cs.width);
    if (this._canvasContainer.style.height)
      ret.height = parseFloat(cs.height);
    return ret;
  }

  get designerOffsetWidth(): number {
    return this._canvasContainer.offsetWidth;
  }
  get designerOffsetHeight(): number {
    return this._canvasContainer.offsetHeight;
  }

  set additionalStyles(value: CSSStyleSheet[]) {
    if (value) {
      let style = '';
      for (let s of value) {
        for (let r of s.cssRules) {
          if (r instanceof CSSStyleRule) {
            let parts = r.selectorText.split(',');
            let t = '';
            for (let p of parts) {
              if (t)
                t += ',';
              t += '#node-projects-designer-canvas-canvas ' + p;
            }
            style += t + '{' + r.style.cssText + '}';
          }
        }
      }

      this.shadowRoot.adoptedStyleSheets = [this.constructor.style, cssFromString(style)];
    }
    else
      this.shadowRoot.adoptedStyleSheets = [this.constructor.style];
  }

  /* --- start IUiCommandHandler --- */

  async executeCommand(command: IUiCommand) {
    const modelCommandService = this.serviceContainer.modelCommandService;
    if (modelCommandService) {
      let handeled = await modelCommandService.executeCommand(this, command)
      if (handeled != null)
        return;
    }
    switch (command.type) {
      case CommandType.screenshot: {
        if (!this.instanceServiceContainer.selectionService.primarySelection) {
          this.zoomToFit();
          this.disableBackgroud();
          await sleep(100);
          const el = this.rootDesignItem.element;
          const sel = this.instanceServiceContainer.selectionService.selectedElements;
          this.instanceServiceContainer.selectionService.setSelectedElements(null);
          const screenshot = await Screenshot.takeScreenshot(el, el.clientWidth, el.clientHeight);
          await exportData(dataURItoBlob(screenshot), "screenshot.png");
          this.instanceServiceContainer.selectionService.setSelectedElements(sel);
          this.enableBackground();
        }
        else {
          if (!Screenshot.screenshotsEnabled) {
            alert("you need to select current tab in next browser dialog, or screenshots will not work correctly");
          }
          const el = this.instanceServiceContainer.selectionService.primarySelection.element;
          const sel = this.instanceServiceContainer.selectionService.selectedElements;
          this.instanceServiceContainer.selectionService.setSelectedElements(null);
          const screenshot = await Screenshot.takeScreenshot(el, el.clientWidth, el.clientHeight);
          await exportData(dataURItoBlob(screenshot), "screenshot.png");
          this.instanceServiceContainer.selectionService.setSelectedElements(sel);
        }
      }
        break;
      case CommandType.setTool: {
        this.serviceContainer.globalContext.tool = this.serviceContainer.designerTools.get(command.parameter);
      }
        break;
      case CommandType.setStrokeColor: {
        this.serviceContainer.globalContext.strokeColor = command.parameter;
      }
        break;
      case CommandType.setFillBrush: {
        this.serviceContainer.globalContext.fillBrush = command.parameter;
      }
        break;
      case CommandType.setStrokeThickness: {
        this.serviceContainer.globalContext.strokeThickness = command.parameter;
      }
        break;
      case CommandType.delete:
        this.handleDeleteCommand();
        break;
      case CommandType.undo:
        this.instanceServiceContainer.undoService.undo();
        break;
      case CommandType.redo:
        this.instanceServiceContainer.undoService.redo();
        break;
      case CommandType.copy:
        this.handleCopyCommand();
        break;
      case CommandType.cut:
        this.handleCopyCommand();
        this.handleDeleteCommand();
        break;
      case CommandType.paste:
        this.handlePasteCommand(command.altKey == true);
        break;
      case CommandType.selectAll:
        this.handleSelectAll();
        break;
    }
  }

  public disableBackgroud() {
    this._backgroundImage = this._canvas.style.backgroundImage;
    this._canvas.style.backgroundImage = 'none';
  }

  public enableBackground() {
    this._canvas.style.backgroundImage = this._backgroundImage;
  }

  public zoomToFit() {
    const autoZomOffset = 10;
    let maxX = 0, maxY = 0, minX = 0, minY = 0;

    this.canvasOffset = { x: 0, y: 0 };
    this.zoomFactor = 1;

    for (let n of DomHelper.getAllChildNodes(this.rootDesignItem.element)) {
      if (n instanceof Element) {
        const rect = n.getBoundingClientRect();
        minX = minX < rect.x ? minX : rect.x;
        minY = minY < rect.y ? minY : rect.y;
        maxX = maxX > rect.x + rect.width + autoZomOffset ? maxX : rect.x + rect.width + autoZomOffset;
        maxY = maxY > rect.y + rect.height + autoZomOffset ? maxY : rect.y + rect.height + autoZomOffset;
      }
    }

    const cvRect = this.getBoundingClientRect();
    maxX -= cvRect.x;
    maxY -= cvRect.y;

    let scaleX = cvRect.width / (maxX / this.zoomFactor);
    let scaleY = cvRect.height / (maxY / this.zoomFactor);

    const dimensions = this.getDesignSurfaceDimensions();
    if (dimensions.width)
      scaleX = cvRect.width / dimensions.width;
    if (dimensions.height)
      scaleY = cvRect.height / dimensions.height;

    let fak = scaleX < scaleY ? scaleX : scaleY;
    if (!isNaN(fak))
      this.zoomFactor = fak;
    //this._zoomInput.value = Math.round(this.zoomFactor * 100) + '%';
  }


  canExecuteCommand(command: IUiCommand) {
    const modelCommandService = this.serviceContainer.modelCommandService;
    if (modelCommandService) {
      let handeled = modelCommandService.canExecuteCommand(this, command)
      if (handeled !== null)
        return handeled;
    }

    if (command.type === CommandType.undo) {
      return this.instanceServiceContainer.undoService.canUndo();
    }
    if (command.type === CommandType.redo) {
      return this.instanceServiceContainer.undoService.canRedo();
    }
    if (command.type === CommandType.setTool) {
      return this.serviceContainer.designerTools.has(command.parameter);
    }


    return true;
  }

  /* --- end IUiCommandHandler --- */

  handleSelectAll() {
    this.instanceServiceContainer.selectionService.setSelectedElements(Array.from(this.rootDesignItem.children()));
  }

  async handleCopyCommand() {
    await this.serviceContainer.copyPasteService.copyItems(this.instanceServiceContainer.selectionService.selectedElements);
  }

  async handlePasteCommand(disableRestoreOfPositions: boolean) {
    const [designItems, positions] = await this.serviceContainer.copyPasteService.getPasteItems(this.serviceContainer, this.instanceServiceContainer);

    let grp = this.rootDesignItem.openGroup("Insert");

    let pasteContainer = this.rootDesignItem;
    let pCon = this.instanceServiceContainer.selectionService.primarySelection;
    while (pCon != null) {
      const containerStyle = getComputedStyle(pCon.element);
      let newContainerService: IPlacementService;
      newContainerService = this.serviceContainer.getLastServiceWhere('containerService', x => x.serviceForContainer(pCon, containerStyle));
      if (newContainerService) {
        if (newContainerService.canEnter(pCon, designItems)) {
          pasteContainer = pCon;
          break;
        } else {
          pCon = pCon.parent;
          continue;
        }
      }
    }

    if (designItems) {
      let containerPos = this.getNormalizedElementCoordinates(pasteContainer.element);
      for (let i = 0; i < designItems.length; i++) {
        let di = designItems[i];
        let pos = positions ? positions[i] : null;
        this.instanceServiceContainer.undoService.execute(new InsertAction(pasteContainer, pasteContainer.childCount, di));
        if (!disableRestoreOfPositions && pos) {
          di.setStyle('left', (pos.x - containerPos.x) + 'px');
          di.setStyle('top', (pos.y - containerPos.y) + 'px');
        }
      }

      const intializationService = this.serviceContainer.intializationService;
      if (intializationService) {
        for (let di of designItems)
          intializationService.init(di);
      }
      this.instanceServiceContainer.selectionService.setSelectedElements(designItems);
    }
    grp.commit();

    this.snapLines.clearSnaplines();
  }

  handleDeleteCommand() {
    let items = this.instanceServiceContainer.selectionService.selectedElements;
    this.instanceServiceContainer.undoService.execute(new DeleteAction(items));
    this.instanceServiceContainer.selectionService.setSelectedElements(null);
  }

  initialize(serviceContainer: ServiceContainer) {
    this.serviceContainer = serviceContainer;

    this.instanceServiceContainer = new InstanceServiceContainer(this);
    this.instanceServiceContainer.register("undoService", new UndoService(this));
    this.instanceServiceContainer.register("selectionService", new SelectionService);

    this.rootDesignItem = DesignItem.GetOrCreateDesignItem(this._canvas, this.serviceContainer, this.instanceServiceContainer);
    this.instanceServiceContainer.register("contentService", new ContentService(this.rootDesignItem));

    this.extensionManager = new ExtensionManager(this);
    this.overlayLayer = new OverlayLayerView(serviceContainer);
    this.overlayLayer.style.pointerEvents = 'none';
    this.clickOverlay.appendChild(this.overlayLayer);
    this.snapLines = new Snaplines(this.overlayLayer);
    this.snapLines.initialize(this.rootDesignItem);

    if (this.serviceContainer.designerPointerExtensions)
      for (let pe of this.serviceContainer.designerPointerExtensions) {
        if (!this._pointerextensions)
          this._pointerextensions = [];
        this._pointerextensions.push(pe.getExtension(this));
      }

    if (this.children) {
      let children = this.children;
      if (this.children.length == 1 && this.children[0] instanceof HTMLSlotElement) {
        children = <any>this.children[0].assignedElements();
      }
      const parser = this.serviceContainer.getLastServiceWhere('htmlParserService', x => x.constructor == DefaultHtmlParserService) as DefaultHtmlParserService;
      this.addDesignItems(parser.createDesignItems(children, this.serviceContainer, this.instanceServiceContainer));
    }
  }

  connectedCallback() {
    if (!this._firstConnect) {
      this._firstConnect = true;
      this.clickOverlay.addEventListener(EventNames.PointerDown, this._pointerEventHandlerBound);
      this.clickOverlay.addEventListener(EventNames.PointerMove, this._pointerEventHandlerBound);
      this.clickOverlay.addEventListener(EventNames.PointerUp, this._pointerEventHandlerBound);
      this.clickOverlay.addEventListener(EventNames.DragEnter, event => this._onDragEnter(event));
      this.clickOverlay.addEventListener(EventNames.DragLeave, event => this._onDragLeave(event));
      this.clickOverlay.addEventListener(EventNames.DragOver, event => this._onDragOver(event));
      this.clickOverlay.addEventListener(EventNames.Drop, event => this._onDrop(event));
      this.clickOverlay.addEventListener(EventNames.KeyDown, this._onKeyDownBound, true);
      this.clickOverlay.addEventListener(EventNames.KeyUp, this._onKeyUpBound, true);
      this.clickOverlay.addEventListener(EventNames.DblClick, this._onDblClickBound, true);
    }
  }

  private _zoomFactorChanged(refreshExtensions = true) {
    //a@ts-ignore
    //this._canvasContainer.style.zoom = <any>this._zoomFactor;
    //this._canvasContainer.style.transform = 'scale(' + this._zoomFactor+') translate(' + this._translate.x + ', '+this._translate.y+')';
    //this._canvasContainer.style.transformOrigin = '0 0';
    this._canvasContainer.style.bottom = this._outercanvas2.offsetHeight >= this._canvasContainer.offsetHeight ? '0' : '';
    this._canvasContainer.style.right = this._outercanvas2.offsetWidth >= this._canvasContainer.offsetWidth ? '0' : '';
    this._updateTransform();
    this._fillCalculationrects();
    this.onZoomFactorChanged.emit(this._zoomFactor);
    if (refreshExtensions)
      this.extensionManager.refreshAllAppliedExtentions();
  }

  _updateTransform() {
    this._scaleFactor = this._zoomFactor;
    this._canvasContainer.style.transform = 'scale(' + this._zoomFactor + ') translate(' + (isNaN(this._canvasOffset.x) ? '0' : this._canvasOffset.x) + 'px, ' + (isNaN(this._canvasOffset.y) ? '0' : this._canvasOffset.y) + 'px)';
    this._canvasContainer.style.transformOrigin = '0 0';
    this.overlayLayer.style.transform = this._canvasContainer.style.transform;
    this.overlayLayer.style.transformOrigin = '0 0';
    this.snapLines.clearSnaplines();
  }


  public setDesignItems(designItems: IDesignItem[]) {
    this._fillCalculationrects();
    this.instanceServiceContainer.undoService.clear();
    this.overlayLayer.removeAllOverlays();
    DomHelper.removeAllChildnodes(this.overlayLayer);
    for (let i of [...this.rootDesignItem.children()])
      this.rootDesignItem._removeChildInternal(i);
    this.addDesignItems(designItems);
    this.instanceServiceContainer.contentService.onContentChanged.emit({ changeType: 'parsed' });
  }

  public addDesignItems(designItems: IDesignItem[]) {
    if (designItems) {
      for (let di of designItems) {
        this.rootDesignItem._insertChildInternal(di);
      }
    }

    const intializationService = this.serviceContainer.intializationService;
    if (intializationService) {
      for (let di of designItems)
        intializationService.init(di);
    }

    this.snapLines.clearSnaplines();
  }

  _dragOverExtensionItem: IDesignItem;
  private _onDragEnter(event: DragEvent) {
    this._fillCalculationrects();
    event.preventDefault();
    const hasTransferDataBindingObject = event.dataTransfer.types.indexOf(dragDropFormatNameBindingObject) >= 0;
    if (hasTransferDataBindingObject) {
      const ddService = this.serviceContainer.bindableObjectDragDropService;
      if (ddService) {
        const effect = ddService.dragEnter(this, event);
        event.dataTransfer.dropEffect = effect;
      }
    }
  }

  private _onDragLeave(event: DragEvent) {
    this._fillCalculationrects();
    event.preventDefault();
    this._canvas.classList.remove('dragFileActive');
    const hasTransferDataBindingObject = event.dataTransfer.types.indexOf(dragDropFormatNameBindingObject) >= 0;
    if (hasTransferDataBindingObject) {
      const ddService = this.serviceContainer.bindableObjectDragDropService;
      if (ddService) {
        const effect = ddService.dragLeave(this, event);
        event.dataTransfer.dropEffect = effect;
      }
    }

    if (this._dragOverExtensionItem) {
      this.extensionManager.removeExtension(this._dragOverExtensionItem, ExtensionType.ContainerExternalDragOver);
      this._dragOverExtensionItem = null;
    }
  }

  private _onDragOver(event: DragEvent) {
    event.preventDefault();
    /*if (this.alignOnSnap) {
      this.snapLines.calculateSnaplines(this.instanceServiceContainer.selectionService.selectedElements);
      //TODO: fix this following code...
      const currentPoint = this.getDesignerMousepoint(event);
      let containerService = this.serviceContainer.getLastServiceWhere('containerService', x => x.serviceForContainer(this.rootDesignItem))
      containerService.finishPlace(this, this.rootDesignItem, this._initialPoint, currentPoint, this.instanceServiceContainer.selectionService.selectedElements);
    }*/

    this._fillCalculationrects();

    if (event.dataTransfer.types.length > 0 && event.dataTransfer.types[0] == 'Files') {
      const ddService = this.serviceContainer.dragDropService;
      if (ddService) {
        const effect = ddService.dragOver(event);
        event.dataTransfer.dropEffect = effect;
        if (effect !== 'none')
          this._canvas.classList.add('dragFileActive');
      }
    } else {
      const hasTransferDataBindingObject = event.dataTransfer.types.indexOf(dragDropFormatNameBindingObject) >= 0;
      if (hasTransferDataBindingObject) {
        const ddService = this.serviceContainer.bindableObjectDragDropService;
        if (ddService) {
          const effect = ddService.dragOver(this, event);
          event.dataTransfer.dropEffect = effect;
        }
      } else {
        let [newContainer] = this._getPossibleContainerForDrop(event);
        if (this._dragOverExtensionItem != newContainer) {
          this.extensionManager.removeExtension(this._dragOverExtensionItem, ExtensionType.ContainerExternalDragOver);
          this.extensionManager.applyExtension(newContainer, ExtensionType.ContainerExternalDragOver);
          this._dragOverExtensionItem = newContainer;
        }
      }
    }
  }

  private _getPossibleContainerForDrop(event: DragEvent): [newContainerElementDesignItem: IDesignItem, newContainerService: IPlacementService] {
    let newContainerElementDesignItem: IDesignItem = null;
    let newContainerService: IPlacementService = null;

    const elementsFromPoint = this.elementsFromPoint(event.x, event.y);
    for (let e of elementsFromPoint) {
      if (e == this.rootDesignItem.element) {
        newContainerElementDesignItem = this.rootDesignItem;
        const containerStyle = getComputedStyle(newContainerElementDesignItem.element);
        newContainerService = this.serviceContainer.getLastServiceWhere('containerService', x => x.serviceForContainer(newContainerElementDesignItem, containerStyle));
        break;
      } else if (false) {
        //check we don't try to move a item over one of its children..
      } else {
        newContainerElementDesignItem = DesignItem.GetOrCreateDesignItem(e, this.serviceContainer, this.instanceServiceContainer);
        const containerStyle = getComputedStyle(newContainerElementDesignItem.element);
        newContainerService = this.serviceContainer.getLastServiceWhere('containerService', x => x.serviceForContainer(newContainerElementDesignItem, containerStyle));
        if (newContainerService) {
          if (newContainerService.canEnterByDrop(newContainerElementDesignItem)) {
            break;
          } else {
            newContainerElementDesignItem = null;
            newContainerService = null;
            continue;
          }
        }
      }
    }
    return [newContainerElementDesignItem, newContainerService];
  }

  private async _onDrop(event: DragEvent) {
    event.preventDefault();
    this._canvas.classList.remove('dragFileActive');

    this._fillCalculationrects();

    if (event.dataTransfer.files?.length > 0) {
      const ddService = this.serviceContainer.dragDropService;
      if (ddService) {
        ddService.drop(this, event);
      }
    }
    else {
      const transferDataBindingObject = event.dataTransfer.getData(dragDropFormatNameBindingObject)
      if (transferDataBindingObject) {
        const bo = JSON.parse(transferDataBindingObject);
        const ddService = this.serviceContainer.bindableObjectDragDropService;
        if (ddService) {
          const effect = ddService.drop(this, event, bo);
          event.dataTransfer.dropEffect = effect;
        }
      }
      else {
        if (this._dragOverExtensionItem) {
          this.extensionManager.removeExtension(this._dragOverExtensionItem, ExtensionType.ContainerExternalDragOver);
          this._dragOverExtensionItem = null;
        }

        let [newContainer] = this._getPossibleContainerForDrop(event);
        if (!newContainer)
          newContainer = this.rootDesignItem;
          
        let pos = this.getNormalizedElementCoordinates(newContainer.element);

        this._fillCalculationrects();
        const position = this.getNormalizedEventCoordinates(event);

        //TODO : we need to use container service for adding to element, so also grid and flexbox work correct
        const transferData = event.dataTransfer.getData(dragDropFormatNameElementDefinition);
        const elementDefinition = <IElementDefinition>JSON.parse(transferData);
        const di = await this.serviceContainer.forSomeServicesTillResult("instanceService", (service) => service.getElement(elementDefinition, this.serviceContainer, this.instanceServiceContainer));
        const grp = di.openGroup("Insert");
        di.setStyle('position', 'absolute');
        di.setStyle('left', (position.x - pos.x) + 'px');
        di.setStyle('top', (position.y - pos.y) + 'px');
        this.instanceServiceContainer.undoService.execute(new InsertAction(newContainer, newContainer.childCount, di));
        grp.commit();
        requestAnimationFrame(() => this.instanceServiceContainer.selectionService.setSelectedElements([di]));
      }
    }
  }

  public showDesignItemContextMenu(designItem: IDesignItem, event: MouseEvent) {
    this._currentContextMenu?.close();
    const mnuItems: IContextMenuItem[] = [];
    for (let cme of this.serviceContainer.designerContextMenuExtensions) {
      if (cme.shouldProvideContextmenu(event, this, designItem, 'designer')) {
        mnuItems.push(...cme.provideContextMenuItems(event, this, designItem));
      }
    }
    let ctxMenu = new ContextMenu(mnuItems, null)
    ctxMenu.display(event);
    return ctxMenu;
  }

  private _onDblClick(event: KeyboardEvent) {
    event.preventDefault();
    this.extensionManager.applyExtension(this.instanceServiceContainer.selectionService.primarySelection, ExtensionType.Doubleclick);
  }

  private onKeyUp(event: KeyboardEvent) {
    if (event.composedPath().indexOf(this.eatEvents) >= 0)
      return;

    event.preventDefault();
  }

  private onKeyDown(event: KeyboardEvent) {
    if (event.composedPath().indexOf(this.eatEvents) >= 0)
      return;

    if ((event.ctrlKey || event.metaKey) && event.key === 'z' && !event.shiftKey)
      this.executeCommand({ type: CommandType.undo, ctrlKey: event.ctrlKey, altKey: event.altKey, shiftKey: event.shiftKey });
    else if ((event.ctrlKey || event.metaKey) && event.key === 'z' && event.shiftKey)
      this.executeCommand({ type: CommandType.redo, ctrlKey: event.ctrlKey, altKey: event.altKey, shiftKey: event.shiftKey });
    else if ((event.ctrlKey || event.metaKey) && event.key === 'y')
      this.executeCommand({ type: CommandType.redo, ctrlKey: event.ctrlKey, altKey: event.altKey, shiftKey: event.shiftKey });
    else if ((event.ctrlKey || event.metaKey) && event.key === 'a')
      this.executeCommand({ type: CommandType.selectAll, ctrlKey: event.ctrlKey, altKey: event.altKey, shiftKey: event.shiftKey });
    else if ((event.ctrlKey || event.metaKey) && event.key === 'c')
      this.executeCommand({ type: CommandType.copy, ctrlKey: event.ctrlKey, altKey: event.altKey, shiftKey: event.shiftKey });
    else if ((event.ctrlKey || event.metaKey) && event.key === 'v')
      this.executeCommand({ type: CommandType.paste, ctrlKey: event.ctrlKey, altKey: event.altKey, shiftKey: event.shiftKey });
    else if ((event.ctrlKey || event.metaKey) && event.key === 'x')
      this.executeCommand({ type: CommandType.cut, ctrlKey: event.ctrlKey, altKey: event.altKey, shiftKey: event.shiftKey });
    else {
      let primarySelection = this.instanceServiceContainer.selectionService.primarySelection;
      if (!primarySelection) {
        return;
      }

      let moveOffset = 1;
      if (event.shiftKey)
        moveOffset = 10;
      switch (event.key) {
        case 'Delete':
        case 'Backspace':
          this.executeCommand({ type: CommandType.delete, ctrlKey: event.ctrlKey, altKey: event.altKey, shiftKey: event.shiftKey });
          break;
        case 'ArrowUp':
          {
            this.instanceServiceContainer.selectionService.selectedElements.forEach(x => x.setStyle('top', parseInt((<HTMLElement>x.element).style.top) - moveOffset + 'px'));
            this.extensionManager.refreshExtensions(this.instanceServiceContainer.selectionService.selectedElements);
          }
          break;
        case 'ArrowDown':
          {
            this.instanceServiceContainer.selectionService.selectedElements.forEach(x => x.setStyle('top', parseInt((<HTMLElement>x.element).style.top) + moveOffset + 'px'));
            this.extensionManager.refreshExtensions(this.instanceServiceContainer.selectionService.selectedElements);
          }
          break;
        case 'ArrowLeft':
          {
            this.instanceServiceContainer.selectionService.selectedElements.forEach(x => x.setStyle('left', parseInt((<HTMLElement>x.element).style.left) - moveOffset + 'px'));
            this.extensionManager.refreshExtensions(this.instanceServiceContainer.selectionService.selectedElements);
          }
          break;
        case 'ArrowRight':
          {
            this.instanceServiceContainer.selectionService.selectedElements.forEach(x => x.setStyle('left', parseInt((<HTMLElement>x.element).style.left) + moveOffset + 'px'));
            this.extensionManager.refreshExtensions(this.instanceServiceContainer.selectionService.selectedElements);
          }
          break;
      }
    }

    event.preventDefault();
  }

  /**
   * Converts the Event x/y coordinates, to the mouse position on the canvas
   */
  public getNormalizedEventCoordinates(event: MouseEvent): IPoint {
    const offsetOfOuterX = (event.clientX - this.outerRect.x) / this.zoomFactor;
    const offsetOfCanvasX = this.containerBoundingRect.x - this.outerRect.x;

    const offsetOfOuterY = (event.clientY - this.outerRect.y) / this.zoomFactor;
    const offsetOfCanvasY = this.containerBoundingRect.y - this.outerRect.y;

    return {
      x: offsetOfOuterX - offsetOfCanvasX / this.zoomFactor,
      y: offsetOfOuterY - offsetOfCanvasY / this.zoomFactor
    };
  }

  /**
   * Converts the Event x/y coordinates, to the mouse position in the viewport
   */
  public getViewportCoordinates(event: MouseEvent): IPoint {
    return {
      x: (event.clientX - this.outerRect.x),
      y: (event.clientY - this.outerRect.y)
    };
  }

  public getNormalizedElementCoordinates(element: Element): IRect {
    const targetRect = element.getBoundingClientRect();
    return { x: (targetRect.x - this.containerBoundingRect.x) / this.scaleFactor, y: (targetRect.y - this.containerBoundingRect.y) / this.scaleFactor, width: targetRect.width / this.scaleFactor, height: targetRect.height / this.scaleFactor };
  }

  public getNormalizedElementCoordinatesAndRealSizes(element: Element): IRect & { realWidth: number, realHeight: number } {
    let ret = this.getNormalizedElementCoordinates(element);
    const st = getComputedStyle(element);
    let realWidth = ret.width;
    let realHeight = ret.height;
    if (st.boxSizing != 'border-box') {
      realWidth = realWidth - (parseFloat(st.borderLeft) + parseFloat(st.paddingLeft) + parseFloat(st.paddingRight) + parseFloat(st.borderRight));
      realHeight = realHeight - (parseFloat(st.borderTop) + parseFloat(st.paddingTop) + parseFloat(st.paddingBottom) + parseFloat(st.borderBottom));
    }
    return { ...ret, realWidth, realHeight };
  }

  public getNormalizedOffsetInElement(event: MouseEvent, element: Element): IPoint {
    const normEvt = this.getNormalizedEventCoordinates(event);
    const normEl = this.getNormalizedElementCoordinates(element);
    return { x: normEvt.x - normEl.x, y: normEvt.y - normEl.y };
  }

  //todo: remove
  public elementFromPoint(x: number, y: number): Element {
    let elements = this.shadowRoot.elementsFromPoint(x, y);
    let element = elements[0];
    if (element === this.clickOverlay)
      element = elements[1];
    if (element === this.clickOverlay)
      element = this._canvas;
    return element;
  }

  public elementsFromPoint(x: number, y: number): Element[] {
    let retVal: Element[] = [];
    let elements = this.shadowRoot.elementsFromPoint(x, y);
    for (let e of elements) {
      if (e == this.clickOverlay)
        continue;
      if (e == this.overlayLayer)
        continue;
      if (e.getRootNode() !== this.shadowRoot)
        continue;
      if (e == this._outercanvas2)
        break;
      retVal.push(e);
      if (e === this._canvas)
        break;
    }
    return retVal;
  }

  public getElementAtPoint(point: IPoint, ignoreElementCallback?: (element: HTMLElement) => boolean) {
    const elements = this.shadowRoot.elementsFromPoint(point.x, point.y);
    let currentElement: HTMLElement = null;

    for (let i = 0; i < elements.length; i++) {
      currentElement = <HTMLElement>elements[i];
      if (currentElement == this._outercanvas2) {
        currentElement = null;
        break;
      }
      if (currentElement == this.clickOverlay) {
        currentElement = null;
        continue;
      }
      if (currentElement == this.overlayLayer) {
        currentElement = null;
        continue;
      }
      if (ignoreElementCallback && ignoreElementCallback(currentElement)) {
        currentElement = null;
        continue;
      }
      if (currentElement.getRootNode() !== this.shadowRoot) {
        currentElement = null;
        continue;
      }
      break;
    }

    return currentElement;
  }

  public showHoverExtension(element: Element) {
    const currentDesignItem = DesignItem.GetOrCreateDesignItem(element, this.serviceContainer, this.instanceServiceContainer);
    if (this._lastHoverDesignItem != currentDesignItem) {
      if (this._lastHoverDesignItem)
        this.extensionManager.removeExtension(this._lastHoverDesignItem, ExtensionType.MouseOver);
      if (currentDesignItem && currentDesignItem != this.rootDesignItem && DomHelper.getHost(element.parentNode) !== this.overlayLayer)
        this.extensionManager.applyExtension(currentDesignItem, ExtensionType.MouseOver);
      this._lastHoverDesignItem = currentDesignItem;
    }
  }

  private _pointerEventHandler(event: PointerEvent, forceElement: Node = null) {
    this._fillCalculationrects();

    if (this._pointerextensions) {
      for (let pe of this._pointerextensions)
        pe.refresh(event);
    }

    if (event.composedPath().indexOf(this.eatEvents) >= 0)
      return;

    let currentElement: Node;
    if (forceElement)
      currentElement = forceElement;
    else {
      currentElement = this.serviceContainer.elementAtPointService.getElementAtPoint(this, { x: event.x, y: event.y });
      if (!currentElement) {
        currentElement = this._canvas;
      }
    }

    if (this._activeTool) {
      this._activeTool.pointerEventHandler(this, event, <Element>currentElement);
      return;
    }

    this.clickOverlay.style.cursor = this._canvas.style.cursor;

    const currentDesignItem = DesignItem.GetOrCreateDesignItem(currentElement, this.serviceContainer, this.instanceServiceContainer);
    this.showHoverExtension(currentDesignItem.element);

    //TODO: needed ??
    if (currentElement && DomHelper.getHost(currentElement.parentNode) === this.overlayLayer) {
      if (this.eatEvents)
        return;
      currentElement = this.instanceServiceContainer.selectionService.primarySelection?.element ?? this._canvas;
    }

    let tool = this.serviceContainer.globalContext.tool ?? this.serviceContainer.designerTools.get(NamedTools.Pointer);

    tool.pointerEventHandler(this, event, <Element>currentElement);
    this._canvas.style.cursor = tool.cursor;
  }

  public captureActiveTool(tool: ITool) {
    this._activeTool = tool;
  }

  public releaseActiveTool() {
    this._activeTool = null;
  }

  private _fillCalculationrects() {
    this.containerBoundingRect = this._canvasContainer.getBoundingClientRect();
    this.outerRect = this._outercanvas2.getBoundingClientRect();
  }

  public addOverlay(element: SVGGraphicsElement, overlayLayer: OverlayLayer = OverlayLayer.Normal) {
    this.overlayLayer.addOverlay(element, overlayLayer);
  }

  public removeOverlay(element: SVGGraphicsElement) {
    this.overlayLayer.removeOverlay(element);
  }

  public zoomOntoRectangle(startPoint: IPoint, endPoint: IPoint) {
    let rect: IRect = {
      x: startPoint.x < endPoint.x ? startPoint.x : endPoint.x,
      y: startPoint.y < endPoint.y ? startPoint.y : endPoint.y,
      width: Math.abs(startPoint.x - endPoint.x),
      height: Math.abs(startPoint.y - endPoint.y),
    }

    let zFactorWidth = this.outerRect.width / rect.width;
    let zFactorHeight = this.outerRect.height / rect.height;

    let zoomFactor = zFactorWidth >= zFactorHeight ? zFactorHeight : zFactorWidth;

    let rectCenter: IPoint = {
      x: (rect.width / 2) + rect.x,
      y: (rect.height / 2) + rect.y
    }

    this.zoomPoint(rectCenter, zoomFactor);
  }

  public zoomPoint(canvasPoint: IPoint, newZoom: number) {
    this.zoomFactor = newZoom;

    const newCanvasOffset = {
      x: -(canvasPoint.x) + this.outerRect.width / this.zoomFactor / 2,
      y: -(canvasPoint.y) + this.outerRect.height / this.zoomFactor / 2
    }

    this.canvasOffset = newCanvasOffset;
  }

  private zoomConvertEventToViewPortCoordinates(point: IPoint): IPoint {
    const offsetOfCanvasX = this.containerBoundingRect.x - this.outerRect.x;
    const offsetOfCanvasY = this.containerBoundingRect.y - this.outerRect.y;

    return {
      x: (point.x + offsetOfCanvasX / this.zoomFactor) * this.zoomFactor,
      y: (point.y + offsetOfCanvasY / this.zoomFactor) * this.zoomFactor
    };
  }


  public zoomTowardsPoint(canvasPoint: IPoint, newZoom: number) {
    const scaleChange = newZoom / this.zoomFactor;

    const point = this.zoomConvertEventToViewPortCoordinates(canvasPoint);

    const newCanvasOffset = {
      x: -(point.x * (scaleChange - 1) + scaleChange * -this.canvasOffsetUnzoomed.x),
      y: -(point.y * (scaleChange - 1) + scaleChange * -this.canvasOffsetUnzoomed.y)
    }

    this.zoomFactor = newZoom;
    this.canvasOffsetUnzoomed = newCanvasOffset;
  }
}

customElements.define('node-projects-designer-canvas', DesignerCanvas);