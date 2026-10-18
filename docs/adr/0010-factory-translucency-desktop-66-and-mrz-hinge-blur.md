# 出厂通透度语义：Desktop 统一 66% 与美人志铰链模糊曲线（出厂零模糊）

---
status: accepted
date: 2026-10-18
---

## 背景

两个实机观感问题（web 截图 vs Desktop 实拍，同一美人志出厂壁纸对照）暴露出一组结构性差异：

1. **Desktop 出厂 55% 偏透**。旧默认：openbmc / uefi-harness 两端 55、美人志 web 35 / Desktop 55（`getSkinSchema` 的 profile 分叉仅覆盖美人志）。主人先试 80% 统一（1.5.9 前的工作树实验），实拍壁纸过实难辨，定为 **66%**。
2. **Web 美人志出厂 35% 壁纸发蒙**。其模糊曲线 `12·t²` 从 0 起步，出厂即带 1px 壁纸模糊 + 1px root 玻璃（GLASS_RULE `backdrop-filter`）+ 2% 放大重采样；而 legacy 两皮肤在各自出厂点（P=55）模糊与玻璃均为 0——**美人志是三皮肤中唯一「出厂自带模糊」的异类**。Desktop 侧因 ADR-0009 的会话区原生直绘（`_centerCol` 自带 background-image、无 filter 无 scale）天然清晰，两端口感差进一步凸显。

## Decision

- **Desktop 出厂默认统一 66%**：`getSkinSchema(skinId, "desktop")` 对**全部**皮肤的 `panelOpacity` 注入 default 66（此前仅美人志改写为 55）。Web 出厂值不变（openbmc / uefi-harness 55、美人志 35）。默认值照旧永不落盘；desktop 加载规范化以 66 为出厂值——等于 66 的存量配置视为默认清理，历史手调值（含旧 55）转为一般 override 保留。
- **美人志模糊曲线铰链化**：`blurPx = t > 0.35 ? round(12·((t−0.35)/0.65)²) : 0`——P≤35 恒零，P=100 到顶 12px 不变；与 legacy 的 `24·max(0,(P−55)/45)²` 完全同构（**每套皮肤在自己的 web 出厂锚点零模糊**）。scale(1.02)、GLASS_RULE、`--dsh-mrz-glass-blur` 变量继续跟随 `blurPx > 0` 自动启停，**runtime 零改动**。
- **纱（30·t²）与随动 α 曲线不动**：35% 出厂的表面纱（0.040）与面板底色（0.35）保持原样——「清晰化」只动壁纸模糊，不降表面遮蔽，避免纯调参路线（P≤20）导致的通体刺眼。
- **被否方案**：① 纯调参 P≤20——表面全透、文字刺眼（主人否决动机）；② 硬阈值（P<40 全零、以上原曲线）——拖动跨 40 时模糊 0→2px 跳变；③ runtime 层全局摘除 scale(1.02)——波及 legacy 高 P 状态与 desktopBlur 候选，爆炸半径大而收益存疑。

## Consequences

- Web 美人志出厂壁纸原生锐度：`backdrop.blur`、`cssVariables`、GLASS_RULE 附带在 P≤35 全部消失，staticCss 仅烘焙 CSS（弹层毛玻璃族为无条件规则，照常发货）。
- Desktop 出厂 66% 的 body::before 模糊 5px→3px、desktopBlur 6.2→4.2px；会话区（ADR-0009 原生直绘）不受影响，R 角缺口处透出的 body::before 与 centerCol 原生壁纸反而更一致。
- 金值大面积更新：`meirenzhi-skin`（P=35 blur 0、cssVariables null、P=55 blur 1）、`personalization-projector`（expectBlur 全组、Desktop P66 测试、REAL factory 测试）、smoke（「1px 壁纸模糊」断言翻转为「web 壁纸规则零模糊 + 纱照旧」；desktopBlur 候选规则在标记域内仍允许出现）。
- ADR-0004 的 legacy 字节等价不变式不受影响（openbmc / uefi-harness 零改动）。

## Amendments

- 无（首版）。

## 附录：grill 共识（Q1–Q8，2026-10-18 会话存档）

1. **Q1** 只改美人志（legacy 出厂本就零模糊，不碰 ADR-0004）。
2. **Q2** 铰链重映射胜出：平滑无跳变、出厂即原生、与 legacy 出厂语义对齐。
3. **Q3** scale / GLASS 跟随 blurPx>0，runtime 零改动。
4. **Q4** 纱 30t² 不动。
5. **Q5** 接受 desktop 金值更新（66% → blur 3px、desktopBlur 4.2px）。
6. **Q6** 立 ADR-0010 + 双语 README 出厂值表述；GLOSSARY「通透度」词条语义未破坏，不动。
7. **Q7** 发版验证路径：主人到另一台机器 DSH WEB 装 1.5.9 实测 35% 观感，不行回修。
8. **Q8** 正式 1.5.9 → npm `latest`。
