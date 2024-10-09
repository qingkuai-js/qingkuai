import { init, noop, derived, constReact, QingKuaiComponent } from "qingkuai/internal"

export default class Test extends QingKuaiComponent{
    constructor(args = {}){
        super(args)

        const { setTemplateStructure, props, refs } = init(this)

        // javascript source code area
        const [_w_a, a] = constReact(1, noop)
        const [_w_b, b] = constReact(2, noop)
        let [_w_$sum, $sum] = derived(_ => _w_a.$ + _w_b.$, _d0_)
    
        console.log(_w_a.$, _w_b.$)

        // template structure area
        setTemplateStructure([
            [
                "h1",
                _ => "Hello " + ({$sum: _w_$sum.$}) + "!",
                ["class", _ => [_w_a.$, "aaa"]]
            ]
        ])

        // debugging setters area
        function _d0_(v){ $sum = v }
        function _dn_(){ a; b; }
    }
}