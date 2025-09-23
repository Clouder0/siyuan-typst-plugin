
# SiYuan Typst Plugin

[中文版](./README_zh_CN.md)

Add Typst Support for SiYuan Note.

Just write using normal Math Block, but wrap it with `\t{typst content}`, for example:

```
Some inline $\t{"typst content" a + b / c}$, and some display block:

$$ \t{
mat(a,b,c;d,e,f;) + mat(1,2,3;4,5,6) \
integral _1 ^n 1 / x "d" x  = ln n
} $$
```

You'll get:

![Showcase](./assets/typst_showcase.png)
