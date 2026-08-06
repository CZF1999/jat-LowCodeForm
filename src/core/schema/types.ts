// Schema类型定义文件

// 组件Schema接口
export interface ComponentSchema {
  id: string;                    // 唯一标识
  type: string;                  // 组件类型
  label: string;                 // 显示名称
  children?: ComponentSchema[];  // 子组件（容器类）
  props: Record<string, any>;    // 属性
  styles: Record<string, string>; // 样式
  events: Record<string, Function>; // 事件绑定
  conditions?: Condition[];       // 条件渲染
  loops?: LoopConfig;             // 循环渲染
  titlePosition?: string;         // 标题位置：'top' | 'left'
  validation?: ValidationConfig;  // 验证配置
}

// 校验配置
export interface ValidationConfig {
  required?: boolean;
  type?: 'string' | 'number' | 'email' | 'phone';
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
}

// 条件渲染配置
export interface Condition {
  type: 'if' | 'elseif' | 'else';
  expression: string;            // 条件表达式
  children: ComponentSchema[];    // 条件为真时渲染的组件
}

// 循环渲染配置
export interface LoopConfig {
  dataSource: string;            // 数据源表达式
  itemName: string;              // 循环变量名
  indexName: string;             // 索引变量名
  children: ComponentSchema[];    // 循环渲染的组件
}

// 页面设置
export interface PageSettings {
  title: string;
  backgroundColor: string;
  width: string;
  height: string;
  meta: Record<string, string>;
  formTitle?: string;
  layout?: 'grid' | 'inline' | 'vertical';
  columns?: number;
}

// 页面Schema接口
export interface PageSchema {
  version: string;               // Schema版本
  info: {
    name: string;
    description: string;
    created: string;
    updated: string;
  };
  settings: PageSettings;        // 页面设置
  components: ComponentSchema[]; // 根组件列表
}

// ========== 表单配置 JSON 导出类型 ==========

// 校验规则
export interface ValidationRule {
  required?: boolean;
  message?: string;
  trigger?: string;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  type?: string;
}

// 级联选择器选项（树形结构）
export interface CascaderOption {
  label: string
  value: any
  children?: CascaderOption[]
}

// 单个字段配置
export interface FieldConfig {
  key: string;
  label: string;
  type?: string;
  span?: number;
  pidField?: string;
  visible?: string;            // 函数体字符串
  options?: string | Array<{label: string, value: any}>;  // 异步函数字符串 | 静态数组
  render?: string;             // 自定义 render 函数体字符串
  rules?: ValidationRule[];
  props?: Record<string, any>;
  defaultValue?: any;
}

// 表单配置 JSON 的顶层结构
export interface FormConfig {
  [formKey: string]: {
    title: string;
    layout: 'grid' | 'inline' | 'vertical';
    columns: number;            // 24栅格列数
    fields: FieldConfig[];
  }
}

// 物料元数据接口
export interface MaterialMeta {
  type: string;           // 组件类型标识
  name: string;          // 显示名称
  icon: string;          // 图标标识
  category: string;      // 分类
  version: string;       // 版本号
  propsSchema: Object;    // 属性Schema
  defaultProps: Object;  // 默认属性
  defaultStyles: Object; // 默认样式
  isContainer: boolean;  // 是否容器组件
  childrenTypes?: string[]; // 允许的子组件类型
}
