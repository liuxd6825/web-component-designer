//TODO:  this function should return the correct property to change a layout,
// for example left/right when left or right is used,
//maybe margin on grid? or transform??

import { IPoint } from "../../interfaces/IPoint.js";
import { IDesignItem } from "../item/IDesignItem.js";

export function filterChildPlaceItems(items: IDesignItem[]) {
  const filterdPlaceItems: IDesignItem[] = [];
  next:
  for (let i of items) {
    let par = i.parent;
    while (par != null && !par.isRootItem) {
      if (items.indexOf(par) >= 0)
        continue next;
      par = par.parent;
    }
    filterdPlaceItems.push(i);

  }
  return filterdPlaceItems;
}

export function placeDesignItem(container: IDesignItem, designItem: IDesignItem, offset: IPoint, mode: 'position' | 'transform' | 'margin' | 'padding') {
  const movedElement = designItem.element;
  const computedStyleMovedElement = getComputedStyle(movedElement);

  if (mode === 'position') {
    let positionedContainerElement = container.element;
    let computedStylePositionedContainer = getComputedStyle(container.element);
    while (computedStylePositionedContainer.position !== 'relative' && computedStylePositionedContainer.position !== 'absolute') {
      positionedContainerElement = positionedContainerElement.parentElement;
      computedStylePositionedContainer = getComputedStyle(positionedContainerElement);
    }

    let oldLeft = null;
    let oldRight = null;
    let oldTop = null;
    let oldBottom = null;

    let containerLeft = 0;
    //@ts-ignore
    let containerRight = 0;
    let containerTop = 0;
    //@ts-ignore
    let containerBottom = 0;

    let hasPositionedLayout = false;
    if (computedStyleMovedElement.position === 'relative' || computedStyleMovedElement.position === 'absolute') {
      oldLeft = parseFloat((<HTMLElement>movedElement).style.left);
      oldLeft = Number.isNaN(oldLeft) ? null : oldLeft;
      oldTop = parseFloat((<HTMLElement>movedElement).style.top);
      oldTop = Number.isNaN(oldTop) ? null : oldTop;
      oldRight = parseFloat((<HTMLElement>movedElement).style.right);
      oldRight = Number.isNaN(oldRight) ? null : oldRight;
      oldBottom = parseFloat((<HTMLElement>movedElement).style.bottom);
      oldBottom = Number.isNaN(oldBottom) ? null : oldBottom;
      hasPositionedLayout = true;
    } else {
      if (positionedContainerElement !== container.element) {
        let posContainerRect = positionedContainerElement.getBoundingClientRect();
        let elementRect = designItem.element.getBoundingClientRect();
        containerLeft = elementRect.left - posContainerRect.left;
        containerRight = elementRect.right - posContainerRect.right;
        containerTop = elementRect.top - posContainerRect.top;
        containerBottom = elementRect.bottom - posContainerRect.bottom;
      }
    }

    if (!hasPositionedLayout)
      designItem.setStyle('position', 'absolute');
    if (oldLeft || oldRight == null)
      designItem.setStyle('left', (offset.x + (oldLeft ?? 0) + containerLeft) + "px");
    if(oldTop || oldBottom == null)
      designItem.setStyle('top', (offset.y + (oldTop ?? 0) + containerTop) + "px");
    if (oldRight)
      designItem.setStyle('right', ((oldRight ?? 0) - offset.x + containerRight) + "px");
    if (oldBottom)
      designItem.setStyle('bottom', ((oldBottom ?? 0) - offset.y + containerBottom) + "px");
  }
}

/*function placeViaPosition(container: IDesignItem, designItem: IDesignItem, offset: IPoint, mode: 'position' | 'transform' | 'margin' | 'padding') {
  
}*/