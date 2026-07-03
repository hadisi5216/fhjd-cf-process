import type { ThemeConfig } from 'antd';

export const appTheme: ThemeConfig = {
  token: {
    colorPrimary: '#126e78',
    colorLink: '#126e78',
    colorLinkHover: '#0f5f67',
    colorLinkActive: '#0b4f56',
    colorInfo: '#126e78',
    colorBorder: '#d9e0ea',
    colorText: '#111827',
    borderRadius: 8,
    controlOutline: 'rgba(18, 110, 120, 0.14)',
  },
  components: {
    Button: {
      primaryShadow: 'none',
      defaultHoverBorderColor: '#126e78',
      defaultHoverColor: '#126e78',
    },
    Input: {
      activeBorderColor: '#126e78',
      activeShadow: '0 0 0 2px rgba(18, 110, 120, 0.12)',
      hoverBorderColor: '#126e78',
    },
    InputNumber: {
      activeBorderColor: '#126e78',
      activeShadow: '0 0 0 2px rgba(18, 110, 120, 0.12)',
      hoverBorderColor: '#126e78',
    },
    Select: {
      activeBorderColor: '#126e78',
      activeOutlineColor: 'rgba(18, 110, 120, 0.12)',
      hoverBorderColor: '#126e78',
      optionSelectedBg: '#e6f4f5',
      optionSelectedColor: '#0b3f47',
    },
    Table: {
      headerBg: '#f7f9fc',
      headerColor: '#475467',
      rowHoverBg: '#f5fafb',
    },
    Menu: {
      itemSelectedBg: '#e6f4f5',
      itemSelectedColor: '#0b3f47',
      itemHoverBg: '#edf3f7',
      itemHoverColor: '#0f172a',
    },
    Pagination: {
      itemActiveBg: '#ffffff',
    },
    Switch: {
      colorPrimary: '#126e78',
      colorPrimaryHover: '#0f5f67',
    },
  },
};
