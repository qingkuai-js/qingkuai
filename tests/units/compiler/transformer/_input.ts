import { formatSourceCode } from "../../../../src/util/shared/sundry"

const complexFileInput = formatSourceCode(`
	<lang-js>
		let title = "QingKuai"
		let showPanel = true
		let error = ""
		let pending = Promise.resolve({ value: "done" })
		let rawHtml = "<strong>dynamic html</strong>"
		let rawText = "fallback text"
		let fallbackText = "N/A"
		let selected
		let mount = document.body
		let list = [
			{ id: 1, text: "A", ok: true },
			{ id: 2, text: "B", ok: false }
		]

		function onHeaderClick() {
			showPanel = !showPanel
		}

		function onItemClick(item, index) {
			item.ok = !item.ok
			title = item.text + index
		}

		function select(item) {
			selected = item
		}
	</lang-js>

	<div class="root" !id>
		<Comp #if={showPanel}>
			<qk:spread #slot={ctx from "header"}>
				<button @click={onHeaderClick}>{ctx.label}</button>
			</qk:spread>

			<div #slot={"body"}>
				<slot name="main">
					<qk:spread>
						<p #for={item, index of list} @click={onItemClick(item, index)} #target={mount}>
							<span #if={item.ok}>{index}: {item.text}</span>
							<span #else>{fallbackText}</span>
						</p>
					</qk:spread>
				</slot>
			</div>
		</Comp>
		<div #elif={error}>{error}</div>
		<div #else>empty panel</div>

		<section #await={pending}>loading...</section>
		<section #then={res}>done: {res.value}</section>
		<section #catch={err}>fail: {err?.message}</section>

		<div #html={rawHtml}>{rawText}</div>

		<div #for={item of 3} #key={item}>
			<div !class={selected === item ? "danger" : ""}></div>
			<button @click={select(item)}></button>
		</div>
	</div>
`)

export default complexFileInput
