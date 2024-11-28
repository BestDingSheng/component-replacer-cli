# Component Replacer CLI

Component Replacer CLI 是一个命令行工具，用于自动替换和格式化 React 组件中的特定元素。它主要用于将 `FormItemExt` 组件及其子组件转换为规则中组件

## 安装 

```
npm i component-replacer-cli
```

## 功能

### 组件替换逻辑

- 定义了一组组件替换规则，指定哪些组件应该被替换成什么。
- `replaceAndFormatComponents`函数使用Babel将代码解析成抽象语法树(AST)。
- 遍历AST，寻找特定模式（例如，带有特定子元素的`<FormItemExt>`组件）。
- 找到匹配项时，根据定义的规则替换组件。
- 还管理导入语句，根据使用的组件添加或删除导入。
- 修改后，使用Prettier格式化代码。

### 具体替换逻辑

- 将`<Input>`替换为`<InputOutLineExt>`
- 将`<Select>`替换为`<SelectOutLineExt>`
- 将`<DatePickerExt.RangePicker>`替换为`<RangePickerOutLineExt>`
- 所有新组件都从'@m-tools/antd-ext'导入

## 使用 

对文件夹下面的 tsx jsx ts js 文件进行修改

```
component-replacer-cli ./src
```

下面案列是针对单个文件进行修改

```
component-replacer-cli ./index.tsx
```