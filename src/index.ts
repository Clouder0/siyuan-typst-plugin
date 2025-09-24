/*
 * Copyright (c) 2024 by frostime. All Rights Reserved.
 * @Author       : frostime
 * @Date         : 2024-06-12 19:48:53
 * @FilePath     : /src/index.ts
 * @LastEditTime : 2024-07-12 18:25:44
 * @Description  :
 */
import { Plugin } from "siyuan";
import SimpleHash from "./hash";
import {
  createTypstCompiler,
  TypstCompiler,
} from "@myriaddreamin/typst.ts/dist/esm/compiler.mjs";
import {
  createTypstRenderer,
  TypstRenderer,
} from "@myriaddreamin/typst.ts/dist/esm/renderer.mjs";
import { preloadFontAssets } from "@myriaddreamin/typst.ts/dist/esm/options.init.mjs";
import QuickLRU from "quick-lru";

export default class TypstPlugin extends Plugin {
  async onload() {
    const decode = (encodedString: string) => {
      return encodedString
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&");
    };

    const randstr = (prefix?: string) => {
      return Math.random()
        .toString(36)
        .replace("0.", prefix || "");
    };

    const lru_cache = new QuickLRU<string, string>({ maxSize: 1024 });

    let context = {
      compiler: createTypstCompiler(),
      renderer: createTypstRenderer(),
    };

    const init_context = async ({ compiler, renderer }) => {
      await Promise.all([
        compiler.init({
          getModule: () =>
            "https://cdn.jsdelivr.net/npm/@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm",
          beforeBuild: [preloadFontAssets()],
        }),
        renderer.init({
          getModule: () =>
            "https://cdn.jsdelivr.net/npm/@myriaddreamin/typst-ts-renderer/pkg/typst_ts_renderer_bg.wasm",
        }),
      ]);
    };
    let _backup_context: {
      compiler: TypstCompiler;
      renderer: TypstRenderer;
    } = {
      compiler: createTypstCompiler(),
      renderer: createTypstRenderer(),
    };
    await init_context(_backup_context);
    const get_backup_context = async () => {
      const res = {
        compiler: _backup_context.compiler,
        renderer: _backup_context.renderer,
      };
      _backup_context.compiler = createTypstCompiler();
      _backup_context.renderer = createTypstRenderer();
      await init_context(_backup_context);
      return res;
    };
    await init_context(context);
    const protyle_observer_map = new Map<object, MutationObserver>();
    let current_parsed = 0;
    const render_block_once = async (element: HTMLElement) => {
      // console.log("block", element);
      const raw_content = element.getAttribute("data-content");
      const is_typst =
        raw_content.startsWith("\\t{") && raw_content.endsWith("}");
      if (!is_typst) {
        if (element.getAttribute("data-render-typst") !== null) {
          // remove previous typst content
          element.removeAttribute("data-render-typst");
          element.firstElementChild.innerHTML = "";
        }
        return;
      }
      const typst_content = decode(raw_content.slice(3, -1));
      const content_hash = SimpleHash.djb2(typst_content)
        .toString()
        .slice(0, 16);
      const first_time =
        element.firstElementChild.firstElementChild?.shadowRoot === null;
      if (
        !first_time &&
        element.getAttribute("data-render-typst") === content_hash
      )
        return;
      element.setAttribute("data-render-typst", content_hash);
      if (first_time) {
        const container = document.createElement("div");
        element.firstElementChild.replaceChildren(container);
        container.attachShadow({
          mode: "open",
        });
      }
      const shadowRoot = element.firstElementChild.firstElementChild.shadowRoot;
      if (lru_cache.has(content_hash)) {
        shadowRoot.innerHTML = lru_cache.get(content_hash);
        return;
      }

      const displayMathTemplate = `
#set page(height: auto, width: auto, margin: 0pt)
#set text(size: 13pt)

$ ${typst_content} $
`;
      const dest = `/tmp/${randstr()}.typ`;
      current_parsed += 1;
      if (current_parsed >= 100) {
        // console.log("Switch to backup compiler!");
        current_parsed = 0;
        const backup = await get_backup_context();
        context.compiler = backup.compiler;
        context.renderer = backup.renderer;
      }
      const compiler = context.compiler;
      const renderer = context.renderer;
      compiler.addSource(dest, displayMathTemplate);
      const result = await compiler.compile({
        mainFilePath: dest,
        diagnostics: "full",
      });
      if (result.diagnostics) {
        // render error! show it directly
        const error_string = Array.from(result.diagnostics.values())
          .map(
            (error) =>
              `[${error.severity}]<${error.package}, ${error.path}, ${error.range}>: ${error.message}`,
          )
          .join("\n");
        shadowRoot.innerHTML = `<div style="color: red;">${error_string}</div>`;
      }
      const vec = result.result!;
      const svg = await renderer.runWithSession(async (session) => {
        renderer.manipulateData({
          renderSession: session,
          action: "reset",
          data: vec,
        });
        const svg = await renderer.renderSvg({
          renderSession: session,
        });
        return svg;
      });
      compiler.unmapShadow(dest);
      shadowRoot.innerHTML = svg;
      element.firstElementChild.setAttribute("class", "katex-display");
      const svgElem = shadowRoot.firstElementChild;
      const width = Number.parseFloat(svgElem.getAttribute("data-width"));
      const height = Number.parseFloat(svgElem.getAttribute("data-height"));
      const defaultEm = 11;
      svgElem.firstElementChild.innerHTML =
        `path {fill: var(--b3-graph-doc-point); stroke: var(--b3-graph-doc-point);}` +
        svgElem.firstElementChild.innerHTML
          .replace("var(--glyph_fill)", "var(--b3-graph-doc-point)")
          .replace("var(--glyph_stroke)", "var(--b3-graph-doc-point)");
      svgElem.setAttribute("width", `${width / defaultEm}em`);
      // svgElem.setAttribute("style", "; display: block; margin: 0 auto;");
      svgElem.setAttribute("style", "margin: 0 auto;display:block;");
      svgElem.setAttribute("height", `${height / defaultEm}em`);
      lru_cache.set(content_hash, shadowRoot.innerHTML);
    };
    const render_inline_once = async (element: HTMLElement) => {
      // console.log("inline", element);
      const raw_content = element.getAttribute("data-content");
      const is_typst =
        raw_content.startsWith("\\t{") && raw_content.endsWith("}");
      if (!is_typst) {
        if (element.getAttribute("data-render-typst") !== null) {
          // clear previous typst content
          element.removeAttribute("data-render-typst");
          // remove shadow root
          element.removeChild(element.firstElementChild);
        }
        return;
      }
      const typst_content = decode(raw_content.slice(3, -1));
      const content_hash = SimpleHash.djb2(typst_content)
        .toString()
        .slice(0, 16);
      const first_time = !element.firstElementChild?.shadowRoot; // on paste, hash doesn't change but shadow root won't be copied, so re-render
      if (
        !first_time &&
        element.getAttribute("data-render-typst") === content_hash
      )
        return;
      element.setAttribute("data-render-typst", content_hash);
      if (first_time) {
        const container = document.createElement("span");
        container.setAttribute("class", "typst-display");
        element.replaceChildren(container);
        container.attachShadow({ mode: "open" });
      }
      const shadowRoot = element.firstElementChild.shadowRoot;
      if (lru_cache.has(content_hash)) {
        shadowRoot.innerHTML = lru_cache.get(content_hash);
        return;
      }
      const inlineMathTemplate = `
#set page(height: auto, width: auto, margin: 0pt)
#set text(size: 13pt)

#let s = state("t", (:))

#let pin(t) = context {
let width = measure(line(length: here().position().y)).width
s.update(it => it.insert(t, width) + it)
}

#show math.equation: it => {
box(it, inset: (top: 0.5em, bottom: 0.5em))
}

$pin("l1")${typst_content}$

#context [
#metadata(s.final().at("l1")) <label>
]
        `;
      const dest = `/tmp/${randstr()}.typ`;
      current_parsed += 1;
      if (current_parsed >= 100) {
        console.log("Switch to backup compiler!");
        current_parsed = 0;
        const backup = await get_backup_context();
        context.compiler = backup.compiler;
        context.renderer = backup.renderer;
      }
      const compiler = context.compiler;
      const renderer = context.renderer;
      compiler.addSource(dest, inlineMathTemplate);
      const result = await compiler.compile({
        mainFilePath: dest,
        diagnostics: "full",
      });
      if (result.diagnostics) {
        // render error! show it directly
        const error_string = Array.from(result.diagnostics.values())
          .map(
            (error) =>
              `[${error.severity}]<${error.package}, ${error.path}, ${error.range}>: ${error.message}`,
          )
          .join("\n");
        shadowRoot.innerHTML = `<div style="color: red;">${error_string}</div>`;
        lru_cache.set(content_hash, shadowRoot.innerHTML);
        return;
      }
      const vec = result.result!;
      const svg = await renderer.runWithSession(async (session) => {
        renderer.manipulateData({
          renderSession: session,
          action: "reset",
          data: vec,
        });
        const svg = await renderer.renderSvg({
          renderSession: session,
        });
        return svg;
      });
      const query = await compiler.query({
        selector: "<label>",
        mainFilePath: dest,
      });
      // parse baselinePosition from query ignore last 2 chars
      const baselinePosition = parseFloat(query[0].value.slice(0, -2));
      compiler.unmapShadow(dest);
      shadowRoot.innerHTML = svg;
      const svgElem = shadowRoot.firstElementChild;
      const width = Number.parseFloat(svgElem.getAttribute("data-width"));
      const height = Number.parseFloat(svgElem.getAttribute("data-height"));
      const defaultEm = 11;
      const shift = height - baselinePosition;
      const shiftEm = shift / defaultEm;
      svgElem.firstElementChild.innerHTML =
        `path {fill: var(--b3-graph-doc-point); stroke: var(--b3-graph-doc-point);}` +
        svgElem.firstElementChild.innerHTML
          .replace("var(--glyph_fill)", "var(--b3-graph-doc-point)")
          .replace("var(--glyph_stroke)", "var(--b3-graph-doc-point)");
      svgElem.setAttribute("style", `vertical-align: -${shiftEm}em;`);
      svgElem.setAttribute("width", `${width / defaultEm}em`);
      svgElem.setAttribute("height", `${height / defaultEm}em`);
      lru_cache.set(content_hash, shadowRoot.innerHTML);
    };
    this.eventBus.on("loaded-protyle-static", (event) => {
      const p = event.detail.protyle;
      const observer = new MutationObserver((mutations) => {
        // console.log("Observed mutations:", mutations.length);
        console.log(mutations);
        const mut_elems = mutations.filter(
          (m) => m.target.nodeType === Node.ELEMENT_NODE,
        );
        // paste operation
        const added_elems = mut_elems
          .filter((m) =>
            (m.target as HTMLElement).classList.contains("protyle-wysiwyg"),
          )
          .map((m) => Array.from(m.addedNodes.values()))
          .flat()
          .filter((n) => n.nodeType === Node.ELEMENT_NODE)
          .map((n) => n as HTMLElement);
        const added_inline_elems = added_elems
          .map((e) =>
            Array.from(
              e
                .querySelectorAll(
                  `span[data-type='inline-math'][data-content^='\\\\t{'][data-content$='}']`,
                )
                .values(),
            ),
          )
          .flat() as HTMLElement[];

        const block_selector = `div.render-node[data-type='NodeMathBlock'][data-content^='\\\\t{'][data-content$='}']`;
        const added_block_elems = added_elems
          .map((e) =>
            Array.from(e.querySelectorAll(block_selector).values()).concat(
              e.matches(block_selector) ? [e] : [],
            ),
          )
          .flat() as HTMLElement[];
        const elements = Array.from(
          new Set(
            mutations
              .filter(
                (mutation) =>
                  mutation.type === "childList" &&
                  mutation.target.nodeType === Node.ELEMENT_NODE,
              )
              .map((mutation) => mutation.target as HTMLElement),
          ),
        );
        const normal_inline = elements.filter(
          (elem) => elem.getAttribute("data-type") === "inline-math",
        );
        const normal_first_block = elements
          .filter((element) => element.parentElement !== null)
          .map((element) => element.parentElement)
          .filter(
            (element) => element.getAttribute("data-type") === "NodeMathBlock",
          );
        const normal_second_block = elements
          .filter((element) => element.parentElement !== null)
          .filter((element) => element.parentElement.parentElement !== null)
          .map((element) => element.parentElement.parentElement)
          .filter(
            (element) => element.getAttribute("data-type") === "NodeMathBlock",
          );
        const final_inline = new Set(normal_inline.concat(added_inline_elems));
        const final_block = new Set(
          normal_first_block
            .concat(normal_second_block)
            .concat(added_block_elems),
        );
        Promise.allSettled(
          Array.from(final_inline)
            .map(render_inline_once)
            .concat(Array.from(final_block).map(render_block_once)),
        )
          .then((results) => {
            Array.from(results)
              .filter((result) => result.status === "rejected")
              .forEach((result) => {
                console.log("Rejected!", result.reason);
              });
          })
          .catch((e) => {
            console.log("Error allSettled", e);
          });
      });
      observer.observe(p.contentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["data-content"],
      });
      // console.log("observer created");
      protyle_observer_map.set(p, observer);
    });
    this.eventBus.on("destroy-protyle", (event) => {
      const p = event.detail.protyle;
      const observer = protyle_observer_map.get(p);
      if (observer) {
        observer.disconnect();
        protyle_observer_map.delete(p);
        // console.log("observer disconnected");
      }
      // console.log(`Destroy Protyle. id: ${p.id}, block id: ${p.block.id}`);
    });
  }
}
