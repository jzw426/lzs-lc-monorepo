/**
 * 临时 LayaAir 环境声明，仅用于 IDE 工程落地前的本地类型检查。
 * B-01 在 LayaAir IDE 3.3.0 创建工程后，必须改用 IDE 生成的 libs 类型并删除本文件。
 */
declare namespace Laya {
  class Node {
    public name: string;
    public x: number;
    public y: number;
    public getChildByName(name: string): Node | null;
  }

  class Sprite extends Node {
    public width: number;
    public height: number;
    public mouseEnabled: boolean;
    public on(type: string, caller: unknown, listener: () => void): void;
    public off(type: string, caller: unknown, listener: () => void): void;
  }

  class Text extends Sprite {
    public text: string;
    public fontSize: number;
    public color: string;
  }

  class Script {
    public owner: Node;
  }

  const version: string;
  const stage: { readonly height: number };
  const timer: { readonly delta: number };
  const Event: { readonly CLICK: string };

  function regClass(): ClassDecorator;
}
