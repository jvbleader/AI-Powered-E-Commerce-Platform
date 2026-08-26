"use client";

import React, { useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { AdminDemographics } from "@/services/admin-api";
import { Smartphone, Monitor, Tablet } from "lucide-react";

interface DemographicsTrioProps {
  data: AdminDemographics | null;
  totalVisits?: number;
  loading?: boolean;
}

export function DemographicsTrio({
  data,
  totalVisits = 0,
  loading,
}: DemographicsTrioProps) {
  const [devicePos, setDevicePos] = useState<{ x: number; y: number } | null>(null);
  const [genderPos, setGenderPos] = useState<{ x: number; y: number } | null>(null);

  if (loading || !data) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-[260px] animate-pulse rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"
          />
        ))}
      </div>
    );
  }

  // 1. Devices data với màu sắc phân biệt rõ ràng và số lượng
  const deviceList = [
    {
      name: "Mobile",
      value: data.devices.mobile,
      count: data.devices.mobile_count,
      color: "#10b981",
      icon: Smartphone,
    },
    {
      name: "Desktop",
      value: data.devices.desktop,
      count: data.devices.desktop_count,
      color: "#3b82f6",
      icon: Monitor,
    },
    {
      name: "Tablet",
      value: data.devices.tablet,
      count: data.devices.tablet_count,
      color: "#f59e0b",
      icon: Tablet,
    },
  ];

  // 2. Gender data với màu Nam (Xanh dương) - Nữ (Hồng) - Khác (Xám) và số lượng
  const genderList = [
    {
      name: "Nam",
      value: data.gender.male,
      count: data.gender.male_count,
      color: "#3b82f6",
    },
    {
      name: "Nữ",
      value: data.gender.female,
      count: data.gender.female_count,
      color: "#ec4899",
    },
    {
      name: "Khác",
      value: data.gender.other,
      count: data.gender.other_count,
      color: "#94a3b8",
    },
  ];

  const totalGenderUsers =
    data.gender.total_count ??
    (data.gender.male_count ?? 0) +
      (data.gender.female_count ?? 0) +
      (data.gender.other_count ?? 0);

  const DeviceTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div className="rounded-lg border border-slate-200 bg-white/95 p-2 text-xs shadow-md backdrop-blur-sm">
          <div className="flex items-center gap-1.5 font-semibold text-slate-800">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            {item.name}
          </div>
          <div className="text-slate-600 mt-1">
            {item.count !== undefined ? (
              <>
                <strong>{item.count.toLocaleString("vi-VN")}</strong> lượt ({item.value}%)
              </>
            ) : (
              <>
                Tỷ lệ: <strong>{item.value}%</strong>
              </>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  const GenderTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div className="rounded-lg border border-slate-200 bg-white/95 p-2 text-xs shadow-md backdrop-blur-sm">
          <div className="flex items-center gap-1.5 font-semibold text-slate-800">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            {item.name}
          </div>
          <div className="text-slate-600 mt-1">
            {item.count !== undefined ? (
              <>
                <strong>{item.count.toLocaleString("vi-VN")}</strong> người ({item.value}%)
              </>
            ) : (
              <>
                Tỷ lệ: <strong>{item.value}%</strong>
              </>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* 1. Thiết bị truy cập */}
      <div className="flex flex-col rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Thiết bị truy cập</h3>
          <p className="text-xs text-slate-600">Tỷ lệ theo loại thiết bị người dùng</p>
        </div>

        <div className="grid grid-cols-12 items-center h-[160px] my-2">
          <div
            className="col-span-7 relative h-full flex items-center justify-center"
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setDevicePos({ x: e.clientX - rect.left + 10, y: e.clientY - rect.top - 20 });
            }}
            onMouseLeave={() => setDevicePos(null)}
          >
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center z-0">
              <span className="text-sm font-bold text-slate-900 leading-tight">
                {totalVisits.toLocaleString("vi-VN")}
              </span>
              <span className="text-[10px] font-medium text-slate-500">Lượt</span>
            </div>

            <ResponsiveContainer width="100%" height="100%" className="z-10 relative">
              <PieChart>
                <Tooltip
                  content={<DeviceTooltip />}
                  position={devicePos ? { x: devicePos.x, y: devicePos.y } : undefined}
                  allowEscapeViewBox={{ x: true, y: true }}
                  isAnimationActive={false}
                  wrapperStyle={{
                    zIndex: 100,
                    pointerEvents: "none",
                  }}
                />
                <Pie
                  data={deviceList}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={65}
                  paddingAngle={2}
                  isAnimationActive={true}
                  animationDuration={500}
                  animationEasing="ease-out"
                >
                  {deviceList.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="col-span-5 space-y-2.5 text-xs pl-1">
            {deviceList.map((dev) => {
              const Icon = dev.icon;
              return (
                <div key={dev.name} className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5 truncate">
                    <span
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: dev.color }}
                    />
                    <Icon
                      className="h-3.5 w-3.5 shrink-0"
                      style={{ color: dev.color }}
                    />
                    <span className="text-[11px] font-medium text-slate-700 truncate">
                      {dev.name}
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-bold text-slate-900 text-[11px]">
                      {dev.value}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2. Độ tuổi người dùng */}
      <div className="flex flex-col rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Độ tuổi người dùng</h3>
          <p className="text-xs text-slate-600">Phân khúc độ tuổi khách hàng</p>
        </div>

        <div className="h-[160px] w-full my-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data.age_groups}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
              <XAxis
                dataKey="group"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 10, fill: "#64748b" }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => `${val}%`}
                tick={{ fontSize: 10, fill: "#64748b" }}
              />
              <Tooltip
                formatter={(val: any, _name: any, item: any) => [
                  item?.payload?.count !== undefined
                    ? `${item.payload.count.toLocaleString("vi-VN")} người (${val}%)`
                    : `${val}%`,
                  "Số lượng",
                ]}
                contentStyle={{
                  borderRadius: "8px",
                  fontSize: "11px",
                  border: "1px solid #e2e8f0",
                }}
              />
              <Bar dataKey="percentage" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 3. Giới tính */}
      <div className="flex flex-col rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Giới tính</h3>
          <p className="text-xs text-slate-600">Cơ cấu giới tính toàn sàn</p>
        </div>

        <div className="grid grid-cols-12 items-center h-[160px] my-2">
          <div
            className="col-span-7 relative h-full flex items-center justify-center"
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setGenderPos({ x: e.clientX - rect.left + 10, y: e.clientY - rect.top - 20 });
            }}
            onMouseLeave={() => setGenderPos(null)}
          >
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center z-0">
              <span className="text-sm font-bold text-slate-900 leading-tight">
                {totalGenderUsers > 0 ? totalGenderUsers.toLocaleString("vi-VN") : "0"}
              </span>
              <span className="text-[10px] font-medium text-slate-500">Người dùng</span>
            </div>

            <ResponsiveContainer width="100%" height="100%" className="z-10 relative">
              <PieChart>
                <Tooltip
                  content={<GenderTooltip />}
                  position={genderPos ? { x: genderPos.x, y: genderPos.y } : undefined}
                  allowEscapeViewBox={{ x: true, y: true }}
                  isAnimationActive={false}
                  wrapperStyle={{
                    zIndex: 100,
                    pointerEvents: "none",
                  }}
                />
                <Pie
                  data={genderList}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={65}
                  paddingAngle={2}
                  isAnimationActive={true}
                  animationDuration={500}
                  animationEasing="ease-out"
                >
                  {genderList.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="col-span-5 space-y-2.5 text-xs pl-1">
            {genderList.map((g) => (
              <div key={g.name} className="flex items-center justify-between gap-1">
                <span className="flex items-center gap-1.5 truncate">
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: g.color }}
                  />
                  <span className="text-[11px] font-medium text-slate-700 truncate">
                    {g.name}
                  </span>
                </span>
                <div className="text-right shrink-0">
                  <span className="font-bold text-slate-900 text-[11px]">
                    {g.value}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
