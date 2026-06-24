/**
 * 测试数据生成器
 * 运行: pnpm generate:test-data
 *
 * 生成 6 组测试数据集，每组 120 条反馈
 */

import * as fs from "fs";
import * as path from "path";

// ===== 类型定义 =====

interface FeedbackItem {
  feedback_id: string;
  content: string;
  user_type: string;
  source: string;
  created_at: string;
  expected_theme: string;
}

interface ProjectConfig {
  name: string;
  product_type: string;
  business_goal: string;
  target_user: string;
  key_metric: string;
}

interface MinimumRequirements {
  min_feedback_count: number;
  min_cluster_count: number;
  max_cluster_count: number;
  min_evidence_per_cluster: number;
  min_top_theme_recall: number;
  max_hallucinated_metric_count: number;
}

interface ExpectedOutput {
  dataset: string;
  project: ProjectConfig;
  expected_top_themes: string[];
  allowed_metrics: string[];
  forbidden_metrics: string[];
  minimum_requirements: MinimumRequirements;
}

interface DatasetConfig {
  filename: string;
  project: ProjectConfig;
  themes: {
    name: string;
    weight: number;
    templates: string[];
    user_types: string[];
  }[];
  expected_top_themes: string[];
  allowed_metrics: string[];
  forbidden_metrics: string[];
}

// ===== 工具函数 =====

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateDate(daysAgo: number = 90): string {
  const date = new Date();
  date.setDate(date.getDate() - randomInt(0, daysAgo));
  return date.toISOString().split("T")[0];
}

function generateFeedbackId(dataset: string, index: number): string {
  return `${dataset}-${String(index + 1).padStart(4, "0")}`;
}

// ===== 数据集配置 =====

const DATASETS: DatasetConfig[] = [
  {
    filename: "b2b-saas-renewal",
    project: {
      name: "CloudCRM 企业版",
      product_type: "B端 SaaS",
      business_goal: "提升续费",
      target_user: "企业销售管理者",
      key_metric: "续费率",
    },
    themes: [
      {
        name: "权限配置复杂",
        weight: 25,
        templates: [
          "权限设置太复杂了，管理员经常配错，导致销售看不到自己客户的数据",
          "角色权限不够灵活，没法按部门单独设置，每次都要找管理员帮忙",
          "希望可以按部门批量设置权限，现在一个一个加太慢了",
          "权限继承逻辑不清楚，子部门和父部门的权限经常冲突",
          "自定义角色功能太少，没法满足我们公司的组织架构需求",
          "权限变更后需要等很久才能生效，有时候要刷新好几次",
        ],
        user_types: ["企业管理员", "IT管理员"],
      },
      {
        name: "续费流程繁琐",
        weight: 20,
        templates: [
          "续费流程太复杂，要填很多表单，还要等审批",
          "希望支持自动续费，每次手动操作很麻烦",
          "续费价格不透明，不知道怎么算的",
          "续费后 license 生效太慢，影响销售正常使用",
          "套餐升级和续费不能一起操作，要分两次",
          "续费提醒不够及时，经常到期了才发现",
        ],
        user_types: ["采购负责人", "企业管理员"],
      },
      {
        name: "报表导出问题",
        weight: 18,
        templates: [
          "导出报表太麻烦，每次都要点很多步",
          "报表下载后格式很乱，还要手动整理才能给老板看",
          "希望支持批量导出 Excel，现在只能一个一个导",
          "导出的数据和页面上看到的不一样，数据不一致",
          "大报表导出经常超时，几百条数据就卡住了",
          "导出的 PDF 排版太丑，客户看到会质疑专业性",
        ],
        user_types: ["销售主管", "数据分析师"],
      },
      {
        name: "登录认证问题",
        weight: 15,
        templates: [
          "登录经常失败，验证码收不到，要打好几次",
          "SSO 配置太复杂，IT 部门搞了好久才弄好",
          "会话超时太短，看个报表的功夫就要重新登录",
          "移动端登录体验很差，经常闪退",
          "忘记密码后重置流程太长，要等邮件还要验证手机",
          "多设备登录会互相踢，出差时很不方便",
        ],
        user_types: ["普通用户", "企业管理员"],
      },
      {
        name: "数据同步延迟",
        weight: 12,
        templates: [
          "数据同步有延迟，销售录完单子要等好几分钟才能在报表里看到",
          "有时候数据会丢，明明保存了但刷新就没了",
          "和第三方系统的数据同步经常出问题",
          "历史数据迁移太慢，我们有几十万条数据要导",
          "数据导入格式要求太严格，稍微有点不对就失败",
          "同步状态没有提示，不知道数据有没有同步成功",
        ],
        user_types: ["数据管理员", "普通用户"],
      },
      {
        name: "移动端体验差",
        weight: 10,
        templates: [
          "移动端功能太少了，很多操作还是要回到电脑上",
          "手机上查看报表很卡，加载要好几秒",
          "移动端的 UI 和 PC 端不一致，体验割裂",
          "希望支持离线查看，出差时网络不好就用不了",
          "移动端通知太多，没法按重要程度筛选",
          "手机上录入数据不方便，表单太复杂",
        ],
        user_types: ["销售代表", "外勤人员"],
      },
    ],
    expected_top_themes: ["权限配置复杂", "续费流程繁琐", "报表导出问题", "登录认证问题"],
    allowed_metrics: ["续费率", "管理员效率", "客服成本", "客户满意度", "功能采纳率"],
    forbidden_metrics: ["DAU", "GMV", "转化率", "客单价"],
  },
  {
    filename: "b2b-saas-activation",
    project: {
      name: "项目管理工具 Pro",
      product_type: "B端 SaaS",
      business_goal: "提升激活",
      target_user: "项目经理和团队成员",
      key_metric: "新用户 7 日激活率",
    },
    themes: [
      {
        name: "新用户引导不足",
        weight: 28,
        templates: [
          "新用户第一次配置太复杂，不知道下一步做什么",
          "引导流程太长，好多步骤可以跳过但不知道跳过会怎样",
          "没有示例数据，新用户打开是空白的不知道怎么用",
          "视频教程太长，不如直接给个快速上手指南",
          "引导和实际功能对不上，跟着做会报错",
          "希望有新手模板，不用从零开始配置",
        ],
        user_types: ["新用户", "试用用户"],
      },
      {
        name: "团队协作困难",
        weight: 22,
        templates: [
          "邀请团队成员流程太复杂，要一个个加",
          "团队权限设置不清楚，不知道谁能看什么",
          "@功能不好用，通知经常收不到",
          "任务分配后没法批量修改，要一个个改",
          "团队看板视图太少，没法按不同维度查看",
          "协作文档和任务关联不上，要来回切换",
        ],
        user_types: ["团队负责人", "普通成员"],
      },
      {
        name: "价格不透明",
        weight: 18,
        templates: [
          "价格有点贵，小团队承担不起",
          "免费版限制太多，刚用起来就被卡住了",
          "套餐功能区分不清楚，不知道该选哪个",
          "按人头收费不合理，有些人只是偶尔看看",
          "希望有按使用量计费的选项",
          "价格页面和实际收费不一致，有隐藏费用",
        ],
        user_types: ["试用用户", "采购负责人"],
      },
      {
        name: "集成能力不足",
        weight: 16,
        templates: [
          "没法和飞书打通，我们公司用飞书办公",
          "API 文档太简陋，开发对接很困难",
          "Webhook 事件太少，很多操作触发不了通知",
          "和 Jira 同步经常出问题，状态对不上",
          "希望支持企业微信通知，现在只能邮件",
          "第三方插件市场东西太少了",
        ],
        user_types: ["技术负责人", "企业管理员"],
      },
      {
        name: "界面复杂难用",
        weight: 16,
        templates: [
          "界面太复杂了，功能太多找不到想要的",
          "自定义视图功能太弱，没法按自己习惯调整",
          "深色模式适配不好，有些地方看不清",
          "移动端体验差，很多功能用不了",
          "搜索功能不好用，经常搜不到想要的内容",
          "页面加载太慢，尤其是看板视图",
        ],
        user_types: ["普通用户", "新用户"],
      },
    ],
    expected_top_themes: ["新用户引导不足", "团队协作困难", "价格不透明"],
    allowed_metrics: ["试用转化率", "新用户激活率", "功能采纳率", "用户满意度"],
    forbidden_metrics: ["续费率", "GMV", "客单价"],
  },
  {
    filename: "ai-product-experience",
    project: {
      name: "AI 写作助手",
      product_type: "C端产品",
      business_goal: "提升留存",
      target_user: "内容创作者和营销人员",
      key_metric: "7 日留存率",
    },
    themes: [
      {
        name: "生成质量不稳定",
        weight: 30,
        templates: [
          "AI 生成的内容质量时好时坏，有时候很惊艳有时候很垃圾",
          "生成的文案经常有事实错误，需要人工核实",
          "长文章生成到一半就断了，质量明显下降",
          "同一类需求每次生成的结果差异很大，不稳定",
          "生成的内容太模板化，缺乏创意",
          "AI 不理解我的品牌调性，生成的内容和品牌不符",
        ],
        user_types: ["内容创作者", "营销人员"],
      },
      {
        name: "使用限制太多",
        weight: 22,
        templates: [
          "每天免费次数太少了，根本不够用",
          "付费套餐太贵，个人用户承担不起",
          "字数限制太严格，写长文要分好几次",
          "高级功能都要付费，基础版太弱了",
          "API 调用限制太多，开发者没法好好用",
          "团队版按人头收费，小团队用不起",
        ],
        user_types: ["免费用户", "试用用户"],
      },
      {
        name: "响应速度慢",
        weight: 18,
        templates: [
          "生成速度太慢了，等半天才出结果",
          "高峰期经常超时，根本用不了",
          "批量生成更慢，要等好久",
          "移动端生成特别卡，有时候会崩溃",
          "历史记录加载很慢，存了几百条就卡了",
          "预览功能有延迟，改一下要等好几秒",
        ],
        user_types: ["高频用户", "付费用户"],
      },
      {
        name: "提示词不友好",
        weight: 16,
        templates: [
          "不知道怎么写提示词才能得到好结果",
          "提示词模板太少了，覆盖不了我的需求",
          "提示词优化建议不够具体，看了还是不会写",
          "希望有中文提示词库，现在都是英文的",
          "提示词长度限制太短，没法给够上下文",
          "提示词调试不方便，每次都要重新生成",
        ],
        user_types: ["新手用户", "普通用户"],
      },
      {
        name: "数据安全担忧",
        weight: 14,
        templates: [
          "担心输入的商业机密会被 AI 学习",
          "没有明确的数据隐私政策",
          "希望支持本地部署，数据不出公司",
          "历史记录能不能加密存储",
          "导出数据格式不标准，迁移不方便",
          "账号安全措施不够，没有二次验证",
        ],
        user_types: ["企业用户", "隐私敏感用户"],
      },
    ],
    expected_top_themes: ["生成质量不稳定", "使用限制太多", "响应速度慢"],
    allowed_metrics: ["留存率", "用户满意度", "NPS", "功能使用率"],
    forbidden_metrics: ["续费率", "GMV", "转化率", "客单价"],
  },
  {
    filename: "ecommerce-conversion",
    project: {
      name: "优选商城",
      product_type: "电商",
      business_goal: "提升转化",
      target_user: "C端消费者",
      key_metric: "下单转化率",
    },
    themes: [
      {
        name: "支付流程问题",
        weight: 25,
        templates: [
          "支付方式太少了，不支持我常用的支付方式",
          "支付页面加载太慢，等半天不敢刷新怕重复扣款",
          "优惠券使用规则不清楚，结算时才知道不能用",
          "分期付款选项不够灵活",
          "支付失败后不知道订单状态，要自己去查",
          "海外用户支付不方便，汇率换算也不清楚",
        ],
        user_types: ["新用户", "老用户"],
      },
      {
        name: "商品搜索差",
        weight: 20,
        templates: [
          "搜索结果不准确，搜出来的和想要的不一样",
          "筛选条件太少了，没法精确找到想要的商品",
          "搜索排序逻辑不清楚，不知道怎么排的",
          "图片搜索功能不好用，识别不准确",
          "搜索历史没法清除，隐私有问题",
          "搜索建议不够智能，经常推荐不相关的",
        ],
        user_types: ["普通用户", "高频用户"],
      },
      {
        name: "物流体验差",
        weight: 18,
        templates: [
          "物流信息更新不及时，不知道货到哪了",
          "配送时间预估不准，经常延迟",
          "没法选择快递公司，有时候送到不方便的地方",
          "退货流程太复杂，要填很多表单",
          "换货周期太长，要等好久",
          "物流费用不透明，结算时才发现有运费",
        ],
        user_types: ["普通用户", "退货用户"],
      },
      {
        name: "商品详情不清晰",
        weight: 16,
        templates: [
          "商品图片太少了，看不出实际效果",
          "尺码表不准确，买回来经常不合适",
          "商品描述夸大其词，实际和描述不符",
          "用户评价有刷单嫌疑，不可信",
          "商品参数不够详细，对比不方便",
          "希望有视频展示，图片看不出质感",
        ],
        user_types: ["新用户", "犹豫用户"],
      },
      {
        name: "售后服务差",
        weight: 14,
        templates: [
          "客服响应太慢，等好久才回复",
          "退换货政策不清晰，客服说法不一致",
          "退款周期太长，要等好多天",
          "投诉渠道不畅通，问题得不到解决",
          "售后态度不好，推诿责任",
          "希望有在线客服，现在只能打电话",
        ],
        user_types: ["投诉用户", "退货用户"],
      },
      {
        name: "价格问题",
        weight: 7,
        templates: [
          "价格波动太大，刚买完就降价了",
          "促销活动规则太复杂，算不清楚",
          "比价功能不好用，不知道是不是最低价",
          "满减门槛太高，凑单很麻烦",
          "会员折扣不够吸引人",
          "价格保护期太短",
        ],
        user_types: ["价格敏感用户", "老用户"],
      },
    ],
    expected_top_themes: ["支付流程问题", "商品搜索差", "物流体验差"],
    allowed_metrics: ["转化率", "客单价", "复购率", "退货率", "GMV"],
    forbidden_metrics: ["续费率", "留存率", "DAU", "NPS"],
  },
  {
    filename: "bi-tool-renewal",
    project: {
      name: "数据洞察 BI 平台",
      product_type: "B端 SaaS",
      business_goal: "提升续费",
      target_user: "数据分析师和业务决策者",
      key_metric: "续费率",
    },
    themes: [
      {
        name: "数据口径不一致",
        weight: 28,
        templates: [
          "同一个指标在不同报表里数值不一样，不知道该信哪个",
          "数据刷新时间不明确，不知道什么时候能看到最新数据",
          "自定义指标计算逻辑不清楚，算出来的数和预期不符",
          "跨表关联查询太慢，几十万数据要等好几分钟",
          "数据精度有问题，小数点后位数不统一",
          "同比环比计算逻辑不透明，不知道怎么算的",
        ],
        user_types: ["数据分析师", "业务负责人"],
      },
      {
        name: "报表性能差",
        weight: 22,
        templates: [
          "复杂报表加载太慢，有时候要等一两分钟",
          "并发用户多了就卡，高峰期基本没法用",
          "大数据量导出经常超时",
          "实时数据看板刷新太慢",
          "移动端查看报表很卡",
          "报表嵌入第三方系统后性能更差",
        ],
        user_types: ["数据分析师", "管理层"],
      },
      {
        name: "权限管理复杂",
        weight: 18,
        templates: [
          "数据权限设置太复杂，要按行级列级分别配置",
          "部门间数据隔离做得不好，有时候能看到不该看的",
          "权限变更后要等很久才生效",
          "临时授权功能不方便，要找管理员",
          "权限审计日志不完善",
          "跨部门数据共享流程太复杂",
        ],
        user_types: ["企业管理员", "IT管理员"],
      },
      {
        name: "可视化能力弱",
        weight: 16,
        templates: [
          "图表类型太少了，有些数据没法直观展示",
          "自定义图表样式功能太弱",
          "仪表盘布局不灵活，没法自由拖拽",
          "图表导出分辨率太低，打印不清楚",
          "交互式筛选功能不好用",
          "希望支持 3D 可视化和地图",
        ],
        user_types: ["数据分析师", "业务人员"],
      },
      {
        name: "数据源接入困难",
        weight: 16,
        templates: [
          "接入新数据源太麻烦，要写很多代码",
          "支持的数据库类型太少",
          "API 文档不完善，对接困难",
          "数据同步经常出问题",
          "实时数据接入延迟太高",
          "数据清洗功能太弱，要配合其他工具",
        ],
        user_types: ["技术负责人", "数据工程师"],
      },
    ],
    expected_top_themes: ["数据口径不一致", "报表性能差", "权限管理复杂"],
    allowed_metrics: ["续费率", "数据准确性", "客户满意度", "管理员效率"],
    forbidden_metrics: ["GMV", "转化率", "客单价", "DAU"],
  },
  {
    filename: "internal-system-cost",
    project: {
      name: "内部 OA 系统",
      product_type: "B端 SaaS",
      business_goal: "降低成本",
      target_user: "全体员工和 HR",
      key_metric: "客服工单量",
    },
    themes: [
      {
        name: "流程审批繁琐",
        weight: 25,
        templates: [
          "请假审批要经过太多层级，效率很低",
          "报销流程太复杂，要贴很多票据",
          "审批节点设置不合理，有些步骤可以合并",
          "移动端审批体验差，经常看不到附件",
          "审批历史查询不方便，要翻好久",
          "加急审批流程不明确",
        ],
        user_types: ["普通员工", "部门经理"],
      },
      {
        name: "系统响应慢",
        weight: 22,
        templates: [
          "系统太卡了，打开页面要等好几秒",
          "高峰期更慢，月底报销的时候基本没法用",
          "批量操作更卡，几十条数据要等好久",
          "移动端比 PC 端还卡",
          "搜索功能响应慢",
          "报表生成太慢",
        ],
        user_types: ["普通员工", "HR"],
      },
      {
        name: "功能分散难用",
        weight: 18,
        templates: [
          "功能入口太分散，找个功能要翻好几层",
          "不同模块的操作逻辑不统一",
          "功能太多了但常用的就那几个",
          "自定义配置太少，没法按部门需求调整",
          "帮助文档不完善，不会用只能问同事",
          "培训资料过时了，和实际功能对不上",
        ],
        user_types: ["新员工", "普通员工"],
      },
      {
        name: "移动端体验差",
        weight: 15,
        templates: [
          "移动端功能太少了，很多操作还是要回到电脑",
          "APP 经常闪退，稳定性很差",
          "移动端消息推送不及时",
          "离线功能基本没有",
          "移动端适配不好，按钮太小点不到",
          "希望支持小程序，不想装 APP",
        ],
        user_types: ["外勤人员", "管理层"],
      },
      {
        name: "数据不互通",
        weight: 12,
        templates: [
          "考勤和薪资数据不互通，要手动核对",
          "不同模块的数据要导出来才能关联分析",
          "历史数据迁移不方便",
          "数据导出格式不标准",
          "数据备份恢复流程不清楚",
          "跨部门数据共享困难",
        ],
        user_types: ["HR", "财务"],
      },
      {
        name: "通知太多太乱",
        weight: 8,
        templates: [
          "通知太多了，重要的被淹没了",
          "通知分类不清楚，不知道哪些紧急",
          "邮件通知和系统通知重复",
          "没法按项目或部门筛选通知",
          "已读未读状态不清晰",
          "希望支持免打扰模式",
        ],
        user_types: ["普通员工", "管理层"],
      },
    ],
    expected_top_themes: ["流程审批繁琐", "系统响应慢", "功能分散难用"],
    allowed_metrics: ["客服成本", "管理员效率", "工单量", "员工满意度"],
    forbidden_metrics: ["续费率", "GMV", "转化率", "DAU", "NPS"],
  },
];

// ===== 生成函数 =====

function generateFeedbackItems(config: DatasetConfig, count: number = 120): FeedbackItem[] {
  const items: FeedbackItem[] = [];

  // Calculate how many items per theme based on weight
  const totalWeight = config.themes.reduce((sum, t) => sum + t.weight, 0);
  const themeCounts = config.themes.map((t) => ({
    theme: t,
    count: Math.round((t.weight / totalWeight) * count),
  }));

  // Adjust to match exact count
  let currentTotal = themeCounts.reduce((sum, t) => sum + t.count, 0);
  while (currentTotal < count) {
    themeCounts[0].count++;
    currentTotal++;
  }
  while (currentTotal > count) {
    themeCounts[themeCounts.length - 1].count--;
    currentTotal--;
  }

  let index = 0;
  for (const { theme, count: themeCount } of themeCounts) {
    for (let i = 0; i < themeCount; i++) {
      const template = randomChoice(theme.templates);
      const userType = randomChoice(theme.user_types);
      const sources = ["客服", "问卷", "访谈", "App Store", "用户反馈", "销售反馈", "社交媒体"];
      const source = randomChoice(sources);

      items.push({
        feedback_id: generateFeedbackId(config.filename, index),
        content: template,
        user_type: userType,
        source,
        created_at: generateDate(90),
        expected_theme: theme.name,
      });
      index++;
    }
  }

  // Shuffle the items
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }

  return items;
}

function generateCsv(items: FeedbackItem[]): string {
  const header = "feedback_id,content,user_type,source,created_at,expected_theme";
  const rows = items.map((item) => {
    // Escape content with commas or quotes
    let content = item.content;
    if (content.includes(",") || content.includes('"') || content.includes("\n")) {
      content = `"${content.replace(/"/g, '""')}"`;
    }
    return `${item.feedback_id},${content},${item.user_type},${item.source},${item.created_at},${item.expected_theme}`;
  });
  return [header, ...rows].join("\n");
}

function generateExpectedJson(config: DatasetConfig): ExpectedOutput {
  return {
    dataset: config.filename,
    project: config.project,
    expected_top_themes: config.expected_top_themes,
    allowed_metrics: config.allowed_metrics,
    forbidden_metrics: config.forbidden_metrics,
    minimum_requirements: {
      min_feedback_count: 100,
      min_cluster_count: 5,
      max_cluster_count: 12,
      min_evidence_per_cluster: 2,
      min_top_theme_recall: 0.6,
      max_hallucinated_metric_count: 0,
    },
  };
}

// ===== 主函数 =====

function main() {
  const feedbackDir = path.join(__dirname, "..", "fixtures", "feedback");
  const expectedDir = path.join(__dirname, "..", "fixtures", "expected");

  // Ensure directories exist
  fs.mkdirSync(feedbackDir, { recursive: true });
  fs.mkdirSync(expectedDir, { recursive: true });

  console.log("🚀 开始生成测试数据集...\n");

  for (const dataset of DATASETS) {
    // Generate CSV
    const feedbackItems = generateFeedbackItems(dataset, 120);
    const csvContent = generateCsv(feedbackItems);
    const csvPath = path.join(feedbackDir, `${dataset.filename}.csv`);
    fs.writeFileSync(csvPath, csvContent, "utf-8");
    console.log(`✅ 生成 CSV: ${dataset.filename}.csv (${feedbackItems.length} 条反馈)`);

    // Generate Expected JSON
    const expectedJson = generateExpectedJson(dataset);
    const jsonPath = path.join(expectedDir, `${dataset.filename}.expected.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(expectedJson, null, 2), "utf-8");
    console.log(`✅ 生成 JSON: ${dataset.filename}.expected.json`);
    console.log(`   产品: ${dataset.project.name}`);
    console.log(`   类型: ${dataset.project.product_type}`);
    console.log(`   目标: ${dataset.project.business_goal}`);
    console.log(`   主题: ${dataset.themes.map((t) => t.name).join(", ")}`);
    console.log("");
  }

  console.log("✨ 所有测试数据集生成完成！");
  console.log(`📁 CSV 文件: ${feedbackDir}`);
  console.log(`📁 JSON 文件: ${expectedDir}`);
}

main();
