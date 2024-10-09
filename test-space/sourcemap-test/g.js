import { init, awaitModule, QingKuaiComponent } from "qingkuai/internal"

export default class Test extends QingKuaiComponent{
  constructor(args = {}){
    super(args)

    const { scts, props } = init(this)

    // string literals area
    const _s0_ = "a"
    const _s1_ = "href"

    // template structure area
    scts([
      awaitModule(
        _ => a,
        ["div", ""], 
        [
          [
            /* a */ _s0_,
            ctx => { const b = ctx(0); return "" + (b) },
            [/* href */ _s1_, ""]
          ], 
          [/* a */ _s0_, "", [/* href */ _s1_, ""]]
        ]
      )
    ])
  }
}