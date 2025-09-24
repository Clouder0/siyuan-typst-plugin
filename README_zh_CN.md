# SiYuan Typst Plugin

[English](./README.md)


为思源笔记添加 Typst 支持，支持在笔记中使用 Typst 语法。

**该项目高度实验性，依赖于思源笔记的 DOM 结构而非稳定 API，可能存在兼容性问题。在思源笔记官方的 Custom Inline Element 功能实现前，可能并没有更好的实现方案。请自行斟酌使用风险。**

使用正常的数学公式块，将 Typst 内容包裹在 `\t{typst content}` 中，例如：

```
Some inline $\t{"typst content" a + b / c}$, and some display block:

$$ \t{
mat(a,b,c;d,e,f;) + mat(1,2,3;4,5,6) \
integral _1 ^n 1 / x "d" x  = ln n
} $$
```

效果如下：

![Showcase](https://cdn.jsdelivr.net/gh/clouder0/siyuan-typst-plugin/asset/typst_showcase.png)

你的内容不局限于数学环境。你可以使用 `\traw{raw typst content}` 来编写任何 Typst 代码。

例如：

```
\traw{
#let my_math = $ cases(
(a + (sqrt(c/(1 + b) + x))/(c + d + 1 + f) = 2)/(d) \
(a + (sqrt(c/(1 + b) + x))/(c + d + 1 + f) = 2)/(d)) $

#show math.frac: f => math.display(f)

#my_math
}
```

函数、变量或任何你喜欢的东西！

该功能主要为块级数学公式设计，虽然也能用于行内数学公式，但可能会出现对齐问题。

## Current Limitations

- 导出/预览等各种渲染显示场景未适配。
- 导入 Typst 包的功能尚未经过测试，可能无法正常工作。

## Caveats

Typst 为行内公式使用 Inline Style，复杂的公式会显得太小。

你可以使用 `display()` 来渲染复杂公式。

例如：

```
Some sum $\t{sum _(i=0) ^n 1  / i}$ and display sum $\t{display(sum _(i=0) ^n 1  / i)}$, and matrix $\t{display(mat(1,2,3;4,5,6))}$
```

Versus KaTeX:

```
Some sum $\sum _{i=0} ^n \frac{1}{i}$ and display sum $\displaystyle \sum _{i=0}^n \frac{1}{i}$, and matrix $\begin{pmatrix} 1 & 2 & 3 \\ 4 & 5 & 6 \end{pmatrix}$and display matrix $\displaystyle \begin{pmatrix} 1 & 2 & 3 \\ 4 & 5 & 6 \end{pmatrix}$
```

![Display Style Showcase](https://cdn.jsdelivr.net/gh/clouder0/siyuan-typst-plugin/asset/display-style.png)
