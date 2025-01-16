# CatPawOpen

Continue the development of CatVodOpen.

# 如何运行

```shell
yarn dev
```

# 如何编译

```shell
yarn build
```

# 调试教程

* windows平台自定义字体支持（flutter windows平台字体渲染效果不好 换个字体有所改善），ttf文件放入data\flutter_assets\fonts\ttf目录即可
* 新增运行时调试支持，基于Node.js Debugging，方便爬虫编写打包后在App内运行时定位问题，支持sourceMap加载。 sourceMap输出请参考 esbuild 打包脚本。
* 调试工作流程 app内开启调试模式 -> 重启app -> 使用chrome等调试器关联进程（参考上面的nodejs官方文档） -> 发现问题 修改源码 打包js -> 应用内重载 -> 继续调试

# 参考资料

* [nodejs应用内调试教程](https://nodejs.org/en/learn/getting-started/debugging)
* [谷歌浏览器调试地址](chrome://inspect)

# 猫配置地址

- assets://js/index.js.md5

# 已知问题

1. 不支持push://协议，某些网盘不可用（猫无法通过push跳转二级，虽然代码可以自动处理push，lazy却存在问题）
2. 不支持设置中心动作交互

# 待完善

* 暂未兼容 push://协议，代码里有Bug
* 批量搜索会出问题，没法识别指定key
* 暂未兼容漫画小说播放逻辑
* 采王二级有问题暂未适配
