/* Worked full cases used by the course reader. */
window.SIMULINK_CASES = {
  t19: {
    setup: "对象 G=1/(s(s+1))；灵敏度权重 W1=10/(s+1)（压低低频），控制权重 W2=0.1；用 hinfsyn 求 K，再闭环阶跃。",
    expected:
      "闭环阶跃超调 <10%，相位裕度 >50°；S 的低频增益被压到 -20dB 以下，T 在高频滚降。把 W1 从 10 调到 100，带宽变大但控制量更容易饱和。",
    errors: [
      "W1 在低频没有积分，S 压不到 0dB 以下——稳态误差消不掉。",
      "W2 太小导致控制器输出巨大，实际执行器饱和。",
      "只做 H∞ 不做 μ 分析，参数摄动后可能失稳。",
    ],
    answers: [
      "S 是灵敏度函数：扰动/模型误差到输出的传递；低频要小。",
      "W1 增大 → 更压低频 S → 抗扰更好，但带宽/控制量代价变大。",
    ],
  },
  t33: {
    setup: "一维非线性 y=x^3，x~N(0,1)；EKF 在 0 处线性化，UKF 取 3 个 sigma 点 0、±√3。",
    expected: "EKF 预测 Var(y)≈0；UKF 得 E[y]=0、Var(y)=15。用 1e4 次采样对比。",
    errors: ["sigma 点权重和不为 1", "协方差非正定仍强行分解", "把 UKF 当万能，模型错两者都错"],
    answers: ["EKF 在 0 处导数为 0，方差被压成 0。", "UKF 用采样近似，强非线性更准但计算量约 2n+1 倍。"],
  },
  t34: {
    setup: "倒立摆初值偏 30°，50 次 Monte Carlo，比较 EKF/UKF 的 RMSE 与发散次数。",
    expected: "EKF 约 0.18 rad、2 次发散；UKF 约 0.09 rad、0 次发散。",
    errors: ["只跑一条曲线就下结论", "两者 Q/R 没对齐", "忽略 UKF 的计算耗时"],
    answers: ["强非线性/大初值误差时 UKF 更稳。", "线性系统两者接近，选 EKF 更省。"],
  },
  t36: {
    setup: "电机状态机：Idle --start--> Running；Running --fault--> Fault；Fault --reset--> Idle。",
    expected: "start 加守卫 [start && !fault]；Fault 自锁，reset 才回 Idle；无冲突迁移。",
    errors: ["迁移条件冲突", "缺默认迁移导致无状态", "动作副作用重复执行"],
    answers: ["状态机只认状态+事件，适合模式切换。", "冲突迁移按优先级执行，必须显式排序。"],
  },
  t39: {
    setup: "把控制器做成 Controller.slx（输入 r,y，输出 u），Top 用 Model block 引用。",
    expected: "接口刷新后编译通过；子模型可单独仿真，主模型只看到端口。",
    errors: ["改了子模型端口没刷新 Model block", "子模型路径丢失", "全局变量冲突"],
    answers: ["Model block 用于复用/分工/独立测试。", "接口不一致会直接编译报错。"],
  },
  t40: {
    setup: "同一对象放 PID 与 LQR 两个变体，变量 CTRL=1/2 切换。",
    expected: "只编译激活变体；两变体端口一致，切换后闭环仍稳定。",
    errors: ["CTRL 未定义", "只测激活变体", "两变体端口不一致"],
    answers: ["变体是一套模型多套实现。", "端口必须一致，否则切换编译失败。"],
  },
  t41: {
    setup: "InitFcn 设 Kp=1.5、Ki=1.2；StopFcn 保存 result.mat。",
    expected: "仿真前变量已存在；结束后文件生成；不阻塞仿真。",
    errors: ["回调里弹窗/重计算", "依赖未初始化变量", "多人协作隐式副作用"],
    answers: ["InitFcn 在仿真开始前执行。", "回调只放轻量初始化/清理。"],
  },
  t42: {
    setup: "写死区 S-Function：|u|<0.1 输出 0，否则输出 u；1 入 1 出。",
    expected: "setup 注册端口；Outputs 实现死区；输入 0.05→0，0.5→0.5。",
    errors: ["端口维度注册错", "连续/离散状态混用", "采样时间未声明"],
    answers: ["S-Function 用于自定义模块/算法。", "Outputs 方法计算输出。"],
  },
  t43: {
    setup: "对含代数环的模型跑 Model Advisor，定位直通路径。",
    expected: "报警指出代数环；加 Unit Delay 或改状态空间后报警消失。",
    errors: ["全信报告或全部忽略", "不记录豁免理由", "检查集与项目规范不一致"],
    answers: ["检查建模规范/静态问题。", "报警不一定是 bug，可能是设计取舍。"],
  },
};
