import { useState, useCallback, useMemo, useEffect } from 'react';
import KpiCard from '../components/KpiCard';
import DivisionCard from '../components/DivisionCard';
import DivisionModal from '../components/DivisionModal';
import OfficeTable from '../components/OfficeTable';
import OfficeModal from '../components/OfficeModal';
import TrendChart from '../components/TrendChart';
import GrowthChart from '../components/GrowthChart';
import { parseExcelFile } from '../utils/parseExcel';
import { mergeMonthlyData } from '../utils/storage';
import { loadDashboard, saveDashboard } from '../utils/firebase';
import { fmtMil } from '../utils/format';

const DEMO_DATA = {
  period: '26년 03월',
  total: {
    grade_final: 'A', grade_quality: 'B', grade_quant: 'S',
    target: 1149, trade_prev: 1008, trade_cur: 1001,
    trade_rate: 0.8712, gj_target: 261, gj_cur: 259, gj_rate: 0.9923,
    hosp_target: 918, hosp_cur: 746, hosp_rate: 0.8126,
    baseline: 16009700240, sales: 19460224682, sales_mil: 19460.22, growth_rate: 0.2155,
  },
  divisions: [
    { name: '서울1', manager: '남궁민', grade_final: 'A', grade_quality: 'B', grade_quant: 'S', target: 239, trade_prev: 197, trade_cur: 193, trade_rate: 0.8075, gj_target: 54, gj_cur: 54, gj_rate: 1.0, hosp_target: 185, hosp_cur: 141, hosp_rate: 0.7622, sales_mil: 3802.34, growth_rate: 0.1761 },
    { name: '서울2', manager: '정진명', grade_final: 'A', grade_quality: 'B', grade_quant: 'S', target: 285, trade_prev: 241, trade_cur: 239, trade_rate: 0.8386, gj_target: 48, gj_cur: 47, gj_rate: 0.9792, hosp_target: 237, hosp_cur: 193, hosp_rate: 0.8143, sales_mil: 4413.53, growth_rate: 0.2559 },
    { name: '지방1', manager: '임병옥', grade_final: 'A', grade_quality: 'B', grade_quant: 'S', target: 332, trade_prev: 284, trade_cur: 284, trade_rate: 0.8554, gj_target: 72, gj_cur: 72, gj_rate: 1.0, hosp_target: 260, hosp_cur: 212, hosp_rate: 0.8154, sales_mil: 6080.30, growth_rate: 0.1859 },
    { name: '지방2', manager: '노희창', grade_final: 'A', grade_quality: 'B', grade_quant: 'S', target: 293, trade_prev: 258, trade_cur: 257, trade_rate: 0.8771, gj_target: 80, gj_cur: 79, gj_rate: 0.9875, hosp_target: 213, hosp_cur: 179, hosp_rate: 0.8404, sales_mil: 4656.38, growth_rate: 0.2503 },
    { name: '프로트랙', manager: '', grade_final: 'Ap', grade_quality: 'A', grade_quant: 'S', target: 30, trade_prev: 28, trade_cur: 28, trade_rate: 0.9333, gj_target: 7, gj_cur: 7, gj_rate: 1.0, hosp_target: 23, hosp_cur: 21, hosp_rate: 0.913, sales_mil: 507.66, growth_rate: 0.2345 },
  ],
  offices: [
    { division: '서울1', office: '병원강원', manager: '김병준', grade_final: 'A', grade_quality: 'B', grade_quant: 'S', target: 51, trade_cur: 41, trade_rate: 0.8039, gj_rate: 1.0, hosp_rate: 0.7632, sales_mil: 931.03, growth_rate: 0.1827 },
    { division: '서울1', office: '병원경인', manager: '정창민', grade_final: 'Ap', grade_quality: 'A', grade_quant: 'S', target: 31, trade_cur: 28, trade_rate: 0.9032, gj_rate: 1.0, hosp_rate: 0.8696, sales_mil: 666.18, growth_rate: 0.2055 },
    { division: '서울1', office: '병원서울1', manager: '박용식', grade_final: 'Bp', grade_quality: 'C', grade_quant: 'S', target: 28, trade_cur: 16, trade_rate: 0.5714, gj_rate: 1.0, hosp_rate: 0.5556, sales_mil: 135.74, growth_rate: 0.2007 },
    { division: '서울1', office: '병원서울2', manager: '박효빈', grade_final: 'Cp', grade_quality: 'C', grade_quant: 'B', target: 23, trade_cur: 17, trade_rate: 0.7391, gj_rate: 1.0, hosp_rate: 0.7368, sales_mil: 134.92, growth_rate: 0.0853 },
    { division: '서울1', office: '병원서울3', manager: '박천광', grade_final: 'Bp', grade_quality: 'C', grade_quant: 'S', target: 29, trade_cur: 20, trade_rate: 0.6897, gj_rate: 1.0, hosp_rate: 0.6538, sales_mil: 185.19, growth_rate: 0.183 },
    { division: '서울1', office: '병원서울4', manager: '최진규', grade_final: 'Cp', grade_quality: 'B', grade_quant: 'C', target: 32, trade_cur: 26, trade_rate: 0.8125, gj_rate: 1.0, hosp_rate: 0.7692, sales_mil: 346.02, growth_rate: 0.0499 },
    { division: '서울1', office: '병원서울5', manager: '하재필', grade_final: 'S', grade_quality: 'S', grade_quant: 'S', target: 7, trade_cur: 7, trade_rate: 1.0, gj_rate: 1.0, hosp_rate: 0, sales_mil: 400.71, growth_rate: 0.2177 },
    { division: '서울1', office: '병원인천', manager: '민병기', grade_final: 'S', grade_quality: 'S', grade_quant: 'S', target: 38, trade_cur: 38, trade_rate: 1.0, gj_rate: 1.0, hosp_rate: 1.0, sales_mil: 1002.56, growth_rate: 0.1927 },
    { division: '서울2', office: '제주', manager: '이동호', grade_final: 'B', grade_quality: 'B', grade_quant: 'B', target: 11, trade_cur: 9, trade_rate: 0.8182, gj_rate: 1.0, hosp_rate: 0.7143, sales_mil: 105.08, growth_rate: 0.1063 },
    { division: '서울2', office: '병원경기1', manager: '이재빈', grade_final: 'Bp', grade_quality: 'C', grade_quant: 'S', target: 38, trade_cur: 30, trade_rate: 0.7895, gj_rate: 1.0, hosp_rate: 0.7586, sales_mil: 826.64, growth_rate: 0.3459 },
    { division: '서울2', office: '병원경기2', manager: '권봉기', grade_final: 'B', grade_quality: 'C', grade_quant: 'A', target: 57, trade_cur: 43, trade_rate: 0.7544, gj_rate: 0.9, hosp_rate: 0.7234, sales_mil: 934.46, growth_rate: 0.1327 },
    { division: '서울2', office: '병원남부1', manager: '김선덕', grade_final: 'A', grade_quality: 'B', grade_quant: 'S', target: 32, trade_cur: 28, trade_rate: 0.875, gj_rate: 1.0, hosp_rate: 0.8462, sales_mil: 732.16, growth_rate: 0.266 },
    { division: '서울2', office: '병원남부2', manager: '이석우', grade_final: 'Cp', grade_quality: 'B', grade_quant: 'C', target: 29, trade_cur: 24, trade_rate: 0.8276, gj_rate: 1.0, hosp_rate: 0.7692, sales_mil: 140.28, growth_rate: 0.0428 },
    { division: '서울2', office: '병원동부', manager: '이윤석', grade_final: 'A', grade_quality: 'B', grade_quant: 'S', target: 52, trade_cur: 45, trade_rate: 0.8654, gj_rate: 1.0, hosp_rate: 0.8696, sales_mil: 445.20, growth_rate: 0.3532 },
    { division: '서울2', office: '병원북부', manager: '박광영', grade_final: 'A', grade_quality: 'B', grade_quant: 'S', target: 38, trade_cur: 34, trade_rate: 0.8947, gj_rate: 1.0, hosp_rate: 0.8788, sales_mil: 758.65, growth_rate: 0.3793 },
    { division: '서울2', office: '병원중부1', manager: '이주강', grade_final: 'Ap', grade_quality: 'A', grade_quant: 'S', target: 26, trade_cur: 24, trade_rate: 0.9231, gj_rate: 1.0, hosp_rate: 0.913, sales_mil: 429.31, growth_rate: 0.2519 },
    { division: '서울2', office: '병원중부2', manager: '최선일', grade_final: 'Bp', grade_quality: 'S', grade_quant: 'C', target: 2, trade_cur: 2, trade_rate: 1.0, gj_rate: 1.0, hosp_rate: 0, sales_mil: 41.76, growth_rate: -0.0777 },
    { division: '지방1', office: '병원경남1', manager: '김상훈', grade_final: 'B', grade_quality: 'B', grade_quant: 'B', target: 63, trade_cur: 53, trade_rate: 0.8413, gj_rate: 1.0, hosp_rate: 0.8039, sales_mil: 1077.88, growth_rate: 0.0972 },
    { division: '지방1', office: '병원경남2', manager: '정철훈', grade_final: 'Bp', grade_quality: 'C', grade_quant: 'S', target: 33, trade_cur: 26, trade_rate: 0.7879, gj_rate: 1.0, hosp_rate: 0.75, sales_mil: 747.56, growth_rate: 0.3302 },
    { division: '지방1', office: '병원대구1', manager: '황선준', grade_final: 'Cp', grade_quality: 'B', grade_quant: 'C', target: 69, trade_cur: 59, trade_rate: 0.8551, gj_rate: 1.0, hosp_rate: 0.8077, sales_mil: 654.53, growth_rate: 0.044 },
    { division: '지방1', office: '병원대구2', manager: '양기호', grade_final: 'A', grade_quality: 'B', grade_quant: 'S', target: 39, trade_cur: 35, trade_rate: 0.8974, gj_rate: 1.0, hosp_rate: 0.8621, sales_mil: 788.31, growth_rate: 0.3759 },
    { division: '지방1', office: '병원부산1', manager: '이창훈', grade_final: 'A', grade_quality: 'B', grade_quant: 'S', target: 42, trade_cur: 36, trade_rate: 0.8571, gj_rate: 1.0, hosp_rate: 0.7879, sales_mil: 681.08, growth_rate: 0.1755 },
    { division: '지방1', office: '병원부산2', manager: '이준원', grade_final: 'A', grade_quality: 'B', grade_quant: 'S', target: 50, trade_cur: 44, trade_rate: 0.88, gj_rate: 1.0, hosp_rate: 0.8537, sales_mil: 1303.50, growth_rate: 0.2291 },
    { division: '지방1', office: '병원부산3', manager: '이창형', grade_final: 'Bp', grade_quality: 'B', grade_quant: 'A', target: 36, trade_cur: 31, trade_rate: 0.8611, gj_rate: 1.0, hosp_rate: 0.8462, sales_mil: 827.45, growth_rate: 0.1139 },
    { division: '지방2', office: '병원광주1', manager: '정지영', grade_final: 'A', grade_quality: 'B', grade_quant: 'S', target: 51, trade_cur: 43, trade_rate: 0.8431, gj_rate: 1.0, hosp_rate: 0.8, sales_mil: 908.72, growth_rate: 0.2123 },
    { division: '지방2', office: '병원광주2', manager: '노회원', grade_final: 'A', grade_quality: 'B', grade_quant: 'S', target: 81, trade_cur: 71, trade_rate: 0.8765, gj_rate: 0.9615, hosp_rate: 0.8364, sales_mil: 1032.16, growth_rate: 0.1701 },
    { division: '지방2', office: '병원대전', manager: '나영호', grade_final: 'Ap', grade_quality: 'A', grade_quant: 'S', target: 56, trade_cur: 51, trade_rate: 0.9107, gj_rate: 1.0, hosp_rate: 0.9, sales_mil: 973.30, growth_rate: 0.1772 },
    { division: '지방2', office: '병원전주', manager: '김도영', grade_final: 'Ap', grade_quality: 'A', grade_quant: 'S', target: 51, trade_cur: 47, trade_rate: 0.9216, gj_rate: 1.0, hosp_rate: 0.9024, sales_mil: 755.17, growth_rate: 0.2932 },
    { division: '지방2', office: '병원청주', manager: '한재우', grade_final: 'A', grade_quality: 'B', grade_quant: 'S', target: 54, trade_cur: 45, trade_rate: 0.8333, gj_rate: 1.0, hosp_rate: 0.7619, sales_mil: 987.04, growth_rate: 0.4478 },
    { division: '프로트랙', office: '프로트랙', manager: '', grade_final: 'Ap', grade_quality: 'A', grade_quant: 'S', target: 30, trade_cur: 28, trade_rate: 0.9333, gj_rate: 1.0, hosp_rate: 0.913, sales_mil: 507.66, growth_rate: 0.2345 },
  ],
  hospitalData: {
    '병원강원': [
      { name: '강원대학교병원', type: '종합병원', beds: 530, customer_name: '홍길동', customer_stage: '4', sales_jan: 98000000, sales_feb: 105000000, sales_mar: 112000000, six_month_total: 580000000, is_traded: true, division: '서울1', office: '병원강원', address: '강원도 춘천시', decision_maker: '김원장', baseline: 0 },
      { name: '원주세브란스기독병원', type: '종합병원', beds: 745, customer_name: '이지훈', customer_stage: '3', sales_jan: 180000000, sales_feb: 195000000, sales_mar: 210000000, six_month_total: 1050000000, is_traded: true, division: '서울1', office: '병원강원', address: '강원도 원주시', decision_maker: '박원장', baseline: 0 },
      { name: '춘천성심병원', type: '종합병원', beds: 462, customer_name: '최은정', customer_stage: '3', sales_jan: 85000000, sales_feb: 90000000, sales_mar: 95000000, six_month_total: 500000000, is_traded: true, division: '서울1', office: '병원강원', address: '강원도 춘천시', decision_maker: '이원장', baseline: 0 },
      { name: '강릉아산병원', type: '종합병원', beds: 335, customer_name: '박재현', customer_stage: '2', sales_jan: 0, sales_feb: 0, sales_mar: 0, six_month_total: 0, is_traded: false, division: '서울1', office: '병원강원', address: '강원도 강릉시', decision_maker: '정원장', baseline: 0 },
    ],
    '병원경인': [
      { name: '분당서울대병원', type: '종합병원', beds: 1359, customer_name: '이승민', customer_stage: '5', sales_jan: 120000000, sales_feb: 130000000, sales_mar: 145000000, six_month_total: 720000000, is_traded: true, division: '서울1', office: '병원경인', address: '경기도 성남시', decision_maker: '강원장', baseline: 0 },
      { name: '아주대학교병원', type: '종합병원', beds: 1221, customer_name: '조민준', customer_stage: '4', sales_jan: 145000000, sales_feb: 158000000, sales_mar: 165000000, six_month_total: 840000000, is_traded: true, division: '서울1', office: '병원경인', address: '경기도 수원시', decision_maker: '류원장', baseline: 0 },
      { name: '차의과학대학교분당차병원', type: '종합병원', beds: 670, customer_name: '한성진', customer_stage: '3', sales_jan: 80000000, sales_feb: 85000000, sales_mar: 92000000, six_month_total: 460000000, is_traded: true, division: '서울1', office: '병원경인', address: '경기도 성남시', decision_maker: '윤원장', baseline: 0 },
      { name: '용인세브란스병원', type: '종합병원', beds: 400, customer_name: '장영훈', customer_stage: '2', sales_jan: 0, sales_feb: 0, sales_mar: 0, six_month_total: 0, is_traded: false, division: '서울1', office: '병원경인', address: '경기도 용인시', decision_maker: '신원장', baseline: 0 },
    ],
    '병원서울1': [
      { name: '서울아산병원', type: '종합병원', beds: 2756, customer_name: '김태현', customer_stage: '5', sales_jan: 250000000, sales_feb: 270000000, sales_mar: 290000000, six_month_total: 1500000000, is_traded: true, division: '서울1', office: '병원서울1', address: '서울시 송파구', decision_maker: '이원장', baseline: 0 },
      { name: '서울성모병원', type: '종합병원', beds: 1228, customer_name: '오지원', customer_stage: '4', sales_jan: 0, sales_feb: 0, sales_mar: 0, six_month_total: 0, is_traded: false, division: '서울1', office: '병원서울1', address: '서울시 서초구', decision_maker: '남원장', baseline: 0 },
    ],
    '병원인천': [
      { name: '인하대학교병원', type: '종합병원', beds: 867, customer_name: '정도윤', customer_stage: '4', sales_jan: 112000000, sales_feb: 120000000, sales_mar: 130000000, six_month_total: 660000000, is_traded: true, division: '서울1', office: '병원인천', address: '인천시 중구', decision_maker: '권원장', baseline: 0 },
      { name: '인천성모병원', type: '종합병원', beds: 620, customer_name: '황민호', customer_stage: '3', sales_jan: 95000000, sales_feb: 100000000, sales_mar: 108000000, six_month_total: 560000000, is_traded: true, division: '서울1', office: '병원인천', address: '인천시 부평구', decision_maker: '손원장', baseline: 0 },
      { name: '길병원', type: '종합병원', beds: 1510, customer_name: '임수연', customer_stage: '4', sales_jan: 180000000, sales_feb: 195000000, sales_mar: 210000000, six_month_total: 1050000000, is_traded: true, division: '서울1', office: '병원인천', address: '인천시 남동구', decision_maker: '차원장', baseline: 0 },
      { name: '가톨릭관동대학교국제성모병원', type: '종합병원', beds: 500, customer_name: '배종혁', customer_stage: '3', sales_jan: 88000000, sales_feb: 93000000, sales_mar: 98000000, six_month_total: 510000000, is_traded: true, division: '서울1', office: '병원인천', address: '인천시 서구', decision_maker: '문원장', baseline: 0 },
    ],
    '병원대전': [
      { name: '충남대학교병원', type: '종합병원', beds: 1047, customer_name: '심재민', customer_stage: '4', sales_jan: 132000000, sales_feb: 145000000, sales_mar: 158000000, six_month_total: 790000000, is_traded: true, division: '지방2', office: '병원대전', address: '대전시 중구', decision_maker: '유원장', baseline: 0 },
      { name: '건양대학교병원', type: '종합병원', beds: 822, customer_name: '전지혜', customer_stage: '3', sales_jan: 105000000, sales_feb: 112000000, sales_mar: 120000000, six_month_total: 620000000, is_traded: true, division: '지방2', office: '병원대전', address: '대전시 서구', decision_maker: '안원장', baseline: 0 },
      { name: '을지대학교병원', type: '종합병원', beds: 722, customer_name: '오현수', customer_stage: '4', sales_jan: 118000000, sales_feb: 125000000, sales_mar: 135000000, six_month_total: 680000000, is_traded: true, division: '지방2', office: '병원대전', address: '대전시 중구', decision_maker: '곽원장', baseline: 0 },
      { name: '대전성모병원', type: '병원', beds: 415, customer_name: '민지영', customer_stage: '2', sales_jan: 0, sales_feb: 0, sales_mar: 0, six_month_total: 0, is_traded: false, division: '지방2', office: '병원대전', address: '대전시 중구', decision_maker: '서원장', baseline: 0 },
      { name: '대전선병원', type: '병원', beds: 500, customer_name: '엄기준', customer_stage: '3', sales_jan: 60000000, sales_feb: 65000000, sales_mar: 72000000, six_month_total: 370000000, is_traded: true, division: '지방2', office: '병원대전', address: '대전시 서구', decision_maker: '하원장', baseline: 0 },
    ],
    '병원부산1': [
      { name: '부산대학교병원', type: '종합병원', beds: 1140, customer_name: '고은경', customer_stage: '4', sales_jan: 142000000, sales_feb: 155000000, sales_mar: 168000000, six_month_total: 850000000, is_traded: true, division: '지방1', office: '병원부산1', address: '부산시 서구', decision_maker: '류원장', baseline: 0 },
      { name: '동아대학교병원', type: '종합병원', beds: 780, customer_name: '표준호', customer_stage: '3', sales_jan: 98000000, sales_feb: 105000000, sales_mar: 112000000, six_month_total: 570000000, is_traded: true, division: '지방1', office: '병원부산1', address: '부산시 서구', decision_maker: '석원장', baseline: 0 },
      { name: '부산성모병원', type: '종합병원', beds: 620, customer_name: '왕지수', customer_stage: '3', sales_jan: 80000000, sales_feb: 86000000, sales_mar: 93000000, six_month_total: 470000000, is_traded: true, division: '지방1', office: '병원부산1', address: '부산시 남구', decision_maker: '태원장', baseline: 0 },
      { name: '메리놀병원', type: '병원', beds: 450, customer_name: '지현아', customer_stage: '2', sales_jan: 0, sales_feb: 0, sales_mar: 0, six_month_total: 0, is_traded: false, division: '지방1', office: '병원부산1', address: '부산시 중구', decision_maker: '도원장', baseline: 0 },
    ],
  },
  trendData: {
    total: {
      '23.12': { trade_cnt: 834, sales_mil: 0, trade_rate: 0.7065 },
      '24.1Q': { trade_cnt: 878, sales_mil: 0, trade_rate: 0.7439 },
      '24.2Q': { trade_cnt: 895, sales_mil: 0, trade_rate: 0.7583 },
      '24.3Q': { trade_cnt: 925, sales_mil: 0, trade_rate: 0.7837 },
      '24.4Q': { trade_cnt: 953, sales_mil: 0, trade_rate: 0.8074 },
      '25.1Q': { trade_cnt: 1031, sales_mil: 0, trade_rate: 0.8737 },
      '25.2Q': { trade_cnt: 1020, sales_mil: 0, trade_rate: 0.8637 },
      '25.3Q': { trade_cnt: 1015, sales_mil: 0, trade_rate: 0.8599 },
      '25.12': { trade_cnt: 1008, sales_mil: 16884.16, trade_rate: 0.849 },
      '26.01': { trade_cnt: 1005, sales_mil: 17216.63, trade_rate: 0.8524 },
      '26.02': { trade_cnt: 1001, sales_mil: 16884.16, trade_rate: 0.849 },
      '26.03': { trade_cnt: 1001, sales_mil: 19460.22, trade_rate: 0.849 },
    },
    divisions: {
      '서울1': { '25.12': { trade_cnt: 197, sales_mil: 3179.04, trade_rate: 0.8075 }, '26.01': { trade_cnt: 195, sales_mil: 3406.54, trade_rate: 0.8159 }, '26.02': { trade_cnt: 193, sales_mil: 3260.50, trade_rate: 0.8075 }, '26.03': { trade_cnt: 193, sales_mil: 3802.34, trade_rate: 0.8075 } },
      '서울2': { '25.12': { trade_cnt: 241, sales_mil: 3512.38, trade_rate: 0.8386 }, '26.01': { trade_cnt: 240, sales_mil: 3850.93, trade_rate: 0.8421 }, '26.02': { trade_cnt: 239, sales_mil: 3799.90, trade_rate: 0.8386 }, '26.03': { trade_cnt: 239, sales_mil: 4413.53, trade_rate: 0.8386 } },
      '지방1': { '25.12': { trade_cnt: 284, sales_mil: 4942.65, trade_rate: 0.8554 }, '26.01': { trade_cnt: 284, sales_mil: 5162.02, trade_rate: 0.8554 }, '26.02': { trade_cnt: 283, sales_mil: 5279.38, trade_rate: 0.8524 }, '26.03': { trade_cnt: 284, sales_mil: 6080.30, trade_rate: 0.8554 } },
      '지방2': { '25.12': { trade_cnt: 258, sales_mil: 3869.82, trade_rate: 0.8805 }, '26.01': { trade_cnt: 258, sales_mil: 4333.55, trade_rate: 0.8805 }, '26.02': { trade_cnt: 258, sales_mil: 4140.78, trade_rate: 0.8805 }, '26.03': { trade_cnt: 257, sales_mil: 4656.38, trade_rate: 0.8771 } },
    },
    offices: {},
  },
};

function Section({ num, title, children }) {
  return (
    <section className="mb-10">
      <div className="flex items-center gap-3 mb-5 pb-3 border-b border-[var(--line)]">
        <span className="text-[10px] font-bold text-[var(--ink-4)] bg-[var(--line-2)] px-2 py-1 rounded tracking-wider">0{num}</span>
        <h2 className="text-sm font-bold text-[var(--ink)] m-0">{title}</h2>
      </div>
      {children}
    </section>
  );
}

export default function Dashboard2nd({ isAdmin, period }) {
  const [data, setData] = useState(DEMO_DATA);
  const [cloudLoading, setCloudLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDivision, setSelectedDivision] = useState(null);
  const [selectedOffice, setSelectedOffice] = useState(null);
  const [uploadError, setUploadError] = useState(null);

  // ── 초기 로딩: Firestore에서 데이터 불러오기 ─────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await loadDashboard('hospital2nd');
      if (cancelled) return;
      if (stored) {
        setData({ ...stored, hospitalData: { ...DEMO_DATA.hospitalData, ...(stored.hospitalData || {}) } });
      }
      setCloudLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const handleFile = useCallback(async (file) => {
    setIsLoading(true);
    setUploadError(null);
    try {
      const parsed = await parseExcelFile(file);
      parsed.period = period; // 사이드바에서 선택한 월로 강제 설정
      const existing = await loadDashboard('hospital2nd');
      const merged = mergeMonthlyData(existing, parsed);
      await saveDashboard('hospital2nd', merged);
      setData(merged);
    } catch (err) {
      setUploadError('업로드 오류: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  }, [period]);

  const handleOfficeClick = useCallback((office) => {
    setSelectedDivision(null);
    setSelectedOffice(office);
  }, []);

  // 선택된 기간에 맞는 데이터 결정
  const displayData = useMemo(() => {
    if (!period || period === data.period) return data;
    const hist = data.history?.[period];
    if (hist) return { ...data, ...hist, period };
    return null; // 해당 기간 데이터 없음
  }, [data, period]);

  const { total, divisions = [], offices = [], trendData, hospitalData = {} } = displayData || {};
  const mainDivisions = (divisions || []).filter(d => d.name !== '프로트랙');

  // 데이터 없는 기간 선택 시 안내 화면
  if (!displayData) {
    return (
      <div>
        {isAdmin && (
          <div className="mb-8">
            <label className="flex items-center justify-center gap-3 p-6 border-2 border-dashed rounded-2xl cursor-pointer hover:border-[var(--accent)] hover:bg-blue-50/30 border-[var(--line)]">
              <span className="text-2xl">📊</span>
              <div>
                <div className="text-sm font-medium text-[var(--ink-2)]">2차병원 엑셀 파일 업로드</div>
                <div className="text-xs text-[var(--ink-4)]">○{period} 마감 실적 기준_2차병원 관리 현황.xlsx</div>
              </div>
              <input type="file" accept=".xlsx,.xls" className="hidden" onChange={e => e.target.files[0] && handleFile(e.target.files[0])} disabled={isLoading} />
            </label>
          </div>
        )}
        <div className="flex flex-col items-center justify-center py-28 text-center">
          <div className="text-6xl mb-5">📭</div>
          <div className="text-base font-bold text-[var(--ink-2)] mb-2">{period} 데이터가 없습니다</div>
          <div className="text-sm text-[var(--ink-4)] leading-relaxed">
            해당 기간의 데이터가 아직 업데이트되지 않았습니다.<br />
            {isAdmin ? '위에서 엑셀 파일을 업로드해주세요.' : '관리자에게 문의하거나 나중에 다시 확인해주세요.'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {isAdmin && (
        <div className="mb-8">
          <label className={`flex items-center justify-center gap-3 p-6 border-2 border-dashed rounded-2xl cursor-pointer transition-all ${isLoading ? 'opacity-60' : 'hover:border-[var(--accent)] hover:bg-blue-50/30'} border-[var(--line)]`}>
            <span className="text-2xl">📊</span>
            <div>
              <div className="text-sm font-medium text-[var(--ink-2)]">{isLoading ? '처리 중...' : '2차병원 엑셀 파일 업로드'}</div>
              <div className="text-xs text-[var(--ink-4)]">○26년 X월 마감 실적 기준_2차병원 관리 현황.xlsx</div>
            </div>
            <input type="file" accept=".xlsx,.xls" className="hidden" onChange={e => e.target.files[0] && handleFile(e.target.files[0])} disabled={isLoading} />
          </label>
          {uploadError && <div className="mt-2 text-xs text-[var(--neg)] bg-red-50 border border-red-200 rounded-lg px-4 py-2">{uploadError}</div>}
        </div>
      )}

      <Section num={1} title="본부 현황">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="전체 거래율" value={total?.trade_rate} type="pct" sub={`거래 ${total?.trade_cur}처 / 대상 ${total?.target}처`} />
          <KpiCard label="종합병원 거래율" value={total?.gj_rate} type="pct" sub={`대상 ${total?.gj_target}처 · 거래 ${total?.gj_cur}처`} />
          <KpiCard label="병원 거래율" value={total?.hosp_rate} type="pct" sub={`대상 ${total?.hosp_target}처 · 거래 ${total?.hosp_cur}처`} />
          <KpiCard label="성장률" value={total?.growth_rate} type="growth" sub={`실적 ${fmtMil(total?.sales_mil)}`} />
        </div>
      </Section>

      <Section num={2} title="거래율 트렌드">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <TrendChart trendData={trendData?.total} title="전체 거래율 추이" />
          <GrowthChart divisions={mainDivisions} title="사업부별 성장률" />
        </div>
      </Section>

      <Section num={3} title="사업부 평가">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {mainDivisions.map(div => (
            <DivisionCard key={div.name} division={div} onClick={setSelectedDivision} />
          ))}
        </div>
      </Section>

      <Section num={4} title="사무소 평가">
        <OfficeTable offices={offices} onOfficeClick={handleOfficeClick} />
      </Section>

      {selectedDivision && (
        <DivisionModal
          division={selectedDivision}
          offices={offices}
          hospitalData={hospitalData}
          trendData={trendData}
          onOfficeClick={handleOfficeClick}
          onClose={() => setSelectedDivision(null)}
        />
      )}
      {selectedOffice && (
        <OfficeModal
          office={selectedOffice}
          hospitals={hospitalData[selectedOffice.office] || []}
          trendData={trendData}
          onClose={() => setSelectedOffice(null)}
        />
      )}
    </div>
  );
}
