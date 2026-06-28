# web开发实践选择题答案核对

- 源文件：`D:\quiz-app\web开发实践选择题.docx`
- 状态：前 35 题为根据题意补全；后 50 题来自原文里的“正确答案”字段。
- 注意：HTML/CSS 第 5 题“CSS 中组合选择器的正确写法是”按“分组/群组选择器”理解，答案给 `C`。如果老师把“组合选择器”泛指关系选择器，这题本身存在歧义。

## HTML / CSS

| 题号 | 题目 | 正确答案 | 答案内容 | 来源 |
| --- | --- | --- | --- | --- |
| 1 | CSS 中 `#nav ul li` 表示（ ） | B | 选择 `#nav` 内部 `ul` 中的所有 `li` 元素 | 补全 |
| 2 | CSS 中设置字体大小的属性是（ ） | B | `font-size` | 补全 |
| 3 | HTML5 中定义表格行的标签是（ ） | B | `<tr>` | 补全 |
| 4 | CSS 中设置元素圆角的属性是（ ） | C | `border-radius` | 补全 |
| 5 | CSS 中组合选择器的正确写法是 | C | `h1, p` | 补全，见上方注意 |
| 6 | HTML5 中用于创建无序列表的标签是（ ） | B | `<ul>` | 补全 |
| 7 | CSS 中后代选择器 `div p` 的含义是（ ） | A | 选择 `div` 内部所有 `p` 元素 | 补全 |
| 8 | CSS 中设置外边距的属性是（ ） | C | `margin` | 补全 |
| 9 | HTML5 中用于定义文档标题的标签是（ ） | C | `<title>` | 补全 |
| 10 | CSS 中表示纯白色的十六进制颜色值是（ ） | D | `#ffffff` | 补全 |
| 11 | CSS 中 `color:#00ff00;` 表示的颜色是（ ） | B | 绿色 | 补全 |
| 12 | CSS 中用于选择 id 为 `header` 的元素的选择器是（ ） | D | `#header` | 补全 |
| 13 | HTML5 中用于输入文本框的标签是（ ） | D | `<input>` | 补全 |
| 14 | HTML5 中创建超链接使用的标签是（ ） | A | `<a>` | 补全 |
| 15 | CSS 中用于设置边框的属性是（ ） | A | `border` | 补全 |

## JavaScript

| 题号 | 题目 | 正确答案 | 答案内容 | 来源 |
| --- | --- | --- | --- | --- |
| 1 | `addEventListener()` 的作用是？ | C | 添加事件监听器 | 补全 |
| 2 | 修改元素内容常用的属性是？ | B | `innerHTML` | 补全 |
| 3 | `console.log(typeof 123);` 的输出结果是？ | B | `number` | 补全 |
| 4 | 获取 HTML 元素常用的方法是？ | B | `document.querySelector()` | 补全 |
| 5 | 执行代码 `console.log(typeof []);` 的结果是什么？ | A | `"object"` | 补全 |
| 6 | 以下哪个关键字用于声明变量？ | C | `let` | 补全 |
| 7 | 以下哪个是对象的正确写法？ | D | `var user = { name: "Tom", age: 18 };` | 补全 |
| 8 | 以下哪个对象代表浏览器窗口？ | D | `window` | 补全 |
| 9 | 以下哪个属性可以修改元素的 CSS 样式？ | D | `style` | 补全 |
| 10 | 定义函数的关键字是？ | A | `function` | 补全 |
| 11 | 变量已声明但还没有被赋值，默认值是什么？ | D | `undefined` | 补全 |
| 12 | `console.log(1 + "2" + 3);` 的输出结果是什么？ | D | `"123"` | 补全 |
| 13 | 把 JSON 格式字符串转换成 JavaScript 对象或数组，应使用哪个方法？ | C | `JSON.parse()` | 补全 |
| 14 | 以下哪个是正确的函数定义？ | A | `function add(a, b) { return a + b; }` | 补全 |
| 15 | `var user = { name: "Tom" };` 访问对象属性的正确方式是？ | A | `user.name` | 补全 |
| 16 | JavaScript 中用于输出信息到浏览器控制台的方法是？ | A | `console.log()` | 补全 |
| 17 | 在 HTML 页面中引入 JavaScript 文件，应使用哪个标签？ | A | `<script>` | 补全 |
| 18 | JavaScript 中表示“未定义”的值是？ | A | `undefined` | 补全 |
| 19 | 创建数组的正确方式是？ | C | `let arr = [1, 2, 3];` | 补全 |
| 20 | JavaScript 是一种什么类型的语言？ | B | 脚本语言 | 补全 |

## Vue / Spring Boot / MyBatis

| 题号 | 题目 | 正确答案 | 答案内容 | 来源 |
| --- | --- | --- | --- | --- |
| 1 | Vue 是一款什么类型的框架？ | B | 前端渐进式 MVVM 框架 | 原文已有 |
| 2 | MyBatis 中 Mapper 方法名通常要和 XML 中哪个属性一致？ | D | `id` | 原文已有 |
| 3 | Vue 中绑定 HTML 元素属性的指令是？ | D | `v-bind` | 原文已有 |
| 4 | MyBatis 的 Mapper 接口通常对应哪个文件？ | A | XML 映射文件 | 原文已有 |
| 5 | 开启 MyBatis 日志打印 SQL 语句的配置属性是？ | B | `mybatis.configuration.log-impl` | 原文已有 |
| 6 | Axios 发送 GET 请求传参，参数会拼接在？ | C | URL 后面 | 原文已有 |
| 7 | Axios 的作用是？ | A | 前后端数据交互、发送 HTTP 请求 | 原文已有 |
| 8 | Spring Boot 中配置数据库密码通常使用哪个属性？ | C | `spring.datasource.password` | 原文已有 |
| 9 | 修改 Spring Boot 端口号应配置？ | D | `server.port=xxxx` | 原文已有 |
| 10 | Vue 遍历数组/对象的指令是？ | C | `v-for` | 原文已有 |
| 11 | Vue 中绑定点击事件的指令是？ | A | `v-on:click` | 原文已有 |
| 12 | Spring Boot 应用中端口号默认是？ | A | `8080` | 原文已有 |
| 13 | Spring Boot 项目默认配置文件名称是？ | C | `application.properties` | 原文已有 |
| 14 | Spring Boot 整合 MyBatis 时，`spring.datasource.driver-class-name` 用于配置什么？ | A | 数据库驱动类 | 原文已有 |
| 15 | 分层与解耦的主要目的是什么？ | B | 降低模块之间依赖，提高维护性和扩展性 | 原文已有 |
| 16 | 以下哪项体现了解耦思想？ | D | Service 依赖接口而不是具体实现类 | 原文已有 |
| 17 | MyBatis 的 XML 映射文件通常放在哪个目录下？ | B | `src/main/resources` | 原文已有 |
| 18 | MyBatis 中遍历集合的标签是？ | B | `<foreach>` | 原文已有 |
| 19 | DI 的中文含义是？ | D | 依赖注入 | 原文已有 |
| 20 | Spring Boot 整合 MyBatis 通常需要引入哪个依赖？ | D | `mybatis-spring-boot-starter` | 原文已有 |
| 21 | MyBatis 映射 XML 中多条件拼接时自动去除开头多余 `AND` 或 `OR`，推荐使用哪个动态 SQL 标签？ | A | `<where>` | 原文已有 |
| 22 | 当同一类型存在多个 Bean 时，可使用哪个注解指定具体 Bean？ | D | `@Qualifier` | 原文已有 |
| 23 | Spring Boot 整合 MyBatis 时，常见的三层结构是？ | A | Controller、Service、Dao/Mapper | 原文已有 |
| 24 | MyBatis 映射文件中的 `namespace` 通常对应什么？ | A | Mapper 接口的全限定名 | 原文已有 |
| 25 | Vue 中双向数据绑定指令是？ | B | `v-model` | 原文已有 |
| 26 | Spring Boot 的主启动类通常包含哪个注解？ | D | `@SpringBootApplication` | 原文已有 |
| 27 | Spring Boot 默认内嵌的 Servlet 容器是？ | B | Tomcat | 原文已有 |
| 28 | `application.properties` 中 `spring.datasource.url` 的作用是？ | B | 配置数据库连接地址 | 原文已有 |
| 29 | 以下哪个属于 Spring Boot Starter？ | C | `spring-boot-starter-web` | 原文已有 |
| 30 | Spring Boot 启动项目的入口方法是？ | A | `main()` | 原文已有 |
| 31 | Spring Boot 项目中 MyBatis 的 Mapper 接口通常使用哪个注解标识？ | A | `@Mapper` | 原文已有 |
| 32 | Axios 发送 POST 请求，参数默认存放在？ | C | 请求体（Request Body） | 原文已有 |
| 33 | Maven 中定义项目依赖的文件是？ | B | `pom.xml` | 原文已有 |
| 34 | Spring Boot 中配置数据库连接信息通常写在哪个文件中？ | D | `application.yml` 或 `application.properties` | 原文已有 |
| 35 | `@RequestMapping`、`@GetMapping`、`@PostMapping` 的作用是？ | A | 请求路径映射 | 原文已有 |
| 36 | MyBatis 映射文件中用于查询的标签是？ | D | `<select>` | 原文已有 |
| 37 | `@SpringBootApplication` 不包含以下哪个注解？ | C | `@RestController` | 原文已有 |
| 38 | Spring Boot 中依赖管理通常使用什么工具？ | D | Maven | 原文已有 |
| 39 | 分层架构中，Controller 层主要负责？ | D | 接收请求并返回响应 | 原文已有 |
| 40 | Vue + Spring Boot 出现跨域问题的根本原因是？ | B | 端口、域名、协议不同 | 原文已有 |
| 41 | 良好的后端分层设计中，Controller 通常调用哪一层？ | C | Service 层 | 原文已有 |
| 42 | Spring Boot 整合 MyBatis 后，Mapper 接口对象通常由谁创建和管理？ | A | Spring 容器 | 原文已有 |
| 43 | Spring 中 IoC 的中文含义是？ | A | 控制反转 | 原文已有 |
| 44 | IoC 的核心思想是？ | A | 对象创建和依赖关系交给 Spring 容器管理 | 原文已有 |
| 45 | MyBatis 的主要作用是？ | A | 简化 Java 对数据库的持久层操作 | 原文已有 |
| 46 | MyBatis 中 `parameterType` 表示什么？ | B | 参数类型 | 原文已有 |
| 47 | 以下哪个注解通常用于标识业务层？ | A | `@Service` | 原文已有 |
| 48 | Spring Boot 支持的配置文件格式包括？ | B | 以上都是 | 原文已有 |
| 49 | DI 的主要作用是？ | D | 降低对象之间的耦合度 | 原文已有 |
| 50 | Spring 中常用的依赖注入注解是？ | D | `@Autowired` | 原文已有 |
