/* Beginner guide data: t41–t43. */
window.SIMULINK_GUIDE = window.SIMULINK_GUIDE || {};
Object.assign(window.SIMULINK_GUIDE, {
  t41: {
    hook: "回调像开机自检、关机保存：在模型生命周期的特定时刻自动执行。",
    goal: "理解 PreLoad/Init/StopFcn 等回调的执行时机与副作用。",
    concepts: [
      ["PreLoad", "加载模型前执行。"],
      ["InitFcn", "开始仿真前初始化变量。"],
      ["StopFcn", "仿真结束后保存/清理。"],
    ],
    math: "无公式；生命周期钩子",
    steps: ["模型属性里写回调", "用 disp/assignin 验证时机", "避免耗时/副作用", "团队约定变量初始化"],
    watch: "回调在对应时刻自动跑；顺序错会导致变量未定义。",
    pitfall: "回调里做重活/弹窗；依赖工作区变量但没初始化；多人协作时隐式行为。",
    quiz: [
      ["InitFcn 什么时候跑？", "仿真开始前。"],
      ["回调适合放什么？", "轻量初始化/清理。"],
    ],
    blocks: ["PreLoad", "Init", "Sim", "Stop"],
  },
  t42: {
    hook: "S-Function 是自己写一个模块：Simulink 管调度，你管算法。",
    goal: "理解 Level-2 MATLAB S-Function 的 Setup/Outputs/Update 结构。",
    concepts: [
      ["S-Function", "自定义模块，注册端口/状态/采样。"],
      ["回调方法", "setup、Outputs、Update、Derivatives。"],
      ["适用", "Simulink 没有的算法/外部集成。"],
    ],
    math: "由你实现的离散/连续状态更新",
    steps: ["写 setup 注册端口", "实现 Outputs/Update", "放进 MATLAB Function/S-Function 模块", "测试边界"],
    watch: "自定义模块和内置模块一样参与求解；状态更新顺序由方法决定。",
    pitfall: "端口/维度注册错；连续/离散状态混用；性能不如内置模块。",
    quiz: [
      ["S-Function 用来做什么？", "自定义模块/算法。"],
      ["哪个方法算输出？", "Outputs。"],
    ],
    blocks: ["Input", "S-Function", "Output"],
  },
  t43: {
    hook: "Model Advisor 像出厂质检：自动检查代数环、未接端口、采样冲突等。",
    goal: "会用 Model Advisor 做建模规范检查，并理解检查项的局限。",
    concepts: [
      ["检查项", "按规范/安全/性能分类。"],
      ["自动修复", "部分问题可一键修。"],
      ["局限", "工具不懂你的意图，报警不等于错。"],
    ],
    math: "无公式；静态检查",
    steps: ["打开 Model Advisor", "选检查集（如 ISO 26262）", "逐条看报告", "修复/豁免并记录"],
    watch: "代数环、未连接端口、采样时间冲突会被标出；有些是设计取舍。",
    pitfall: "全信报告/全部忽略；不记录豁免理由；检查集与项目规范不一致。",
    quiz: [
      ["Model Advisor 检查什么？", "建模规范/静态问题。"],
      ["报警一定是 bug 吗？", "不一定，可能是设计取舍。"],
    ],
    blocks: ["Model", "Advisor", "Report"],
  },
});
