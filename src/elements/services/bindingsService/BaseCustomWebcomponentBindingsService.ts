import { IDesignItem } from "../../item/IDesignItem";
import { IBinding } from '../../item/IBinding';
import { IBindingService } from "./IBindingService";
import { BindingMode } from '../../item/BindingMode';
import { BindingTarget } from "../../item/BindingTarget.js";


export class BaseCustomWebcomponentBindingsService implements IBindingService {

  public static type = 'base-custom-webcomponent-binding'

  getBindings(designItem: IDesignItem): IBinding[] {
    const bindings = [];
    for (let a of designItem.attributes) {
      const name = a[0];
      const value = a[1];
      if ((value.startsWith('[[') || value.startsWith('{{')) && (value.endsWith('}}') || value.endsWith(']]'))) {
        let bnd: IBinding = { rawName: name, rawValue: value };
        if (a[0].startsWith('css:')) {
          bnd.targetName = name.substring(4);
          bnd.target = BindingTarget.css;
          bnd.expression = value.substring(2, value.length - 4);
        } else if (a[0].startsWith('class:')) {
          bnd.targetName = name.substring(4);
          bnd.target = BindingTarget.class;
          bnd.expression = value.substring(2, value.length - 4);
        } else if (a[0].startsWith('$')) {
          bnd.targetName = name.substring(1);
          bnd.target = BindingTarget.attribute;
          bnd.expression = value.substring(2, value.length - 4);
        } else if (a[0].startsWith('@')) {
          bnd.targetName = name.substring(1);
          bnd.target = BindingTarget.event;
          bnd.expression = value.substring(2, value.length - 4);
        } else {
          bnd.targetName = name;
          bnd.target = BindingTarget.property;
          bnd.expression = value.substring(2, value.length - 4);
        }
        bnd.type = BaseCustomWebcomponentBindingsService.type;
        bnd.targetName = bnd.targetName;
        bindings.push(bnd);
      }
    }

    return null;
  }

  setBinding(designItem: IDesignItem, binding: IBinding): boolean {
    if (binding.type !== BaseCustomWebcomponentBindingsService.type)
      return false;
      
    let nm = '';
    switch (binding.target) {
      case BindingTarget.css:
        nm += 'css:';
        break;
      case BindingTarget.class:
        nm += 'class';
        break;
      case BindingTarget.attribute:
        nm += '$';
        break;
      case BindingTarget.event:
        nm += '@';
        break;
    }
    nm += binding.targetName;
    let value = (binding.mode == BindingMode.oneWay ? '[[' : '{{') + binding.expression + (binding.mode == BindingMode.oneWay ? ']]' : '}}')
    designItem.setAttribute(nm, value);
    return true;
  }
}