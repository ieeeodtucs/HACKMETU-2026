import type { Agent } from "@kovan/shared";
import {
  PowerIcon,
  ArrowsClockwiseIcon,
  LockIcon,
  InfoIcon,
  HardDrivesIcon,
  WifiHighIcon as NetworkIcon,
  ListBulletsIcon,
  CpuIcon,
  MemoryIcon,
  GlobeSimpleIcon,
  WifiHighIcon,
} from "@phosphor-icons/react";
import { isWindows } from "./helpers";
import React from "react";

export interface MachineAction {
  id: string;
  label: string;
  desc: string;
  icon: React.ReactNode;
  color: string;
  confirm?: string;
  getCommand: (agent: Agent) => string;
}

export interface ActionModalState {
  action: MachineAction;
  commandId: string;
  commandStr: string;
  status: "pending" | "running" | "completed" | "error";
  output: string | null;
  error: string | null;
}

export const ACTIONS: { category: string; icon: React.ReactNode; items: MachineAction[] }[] = [
  {
    category: "Güç Yönetimi",
    icon: React.createElement(PowerIcon, { size: 14, weight: "bold" }),
    items: [
      {
        id: "shutdown",
        label: "Kapat",
        desc: "Makineyi kapat",
        icon: React.createElement(PowerIcon, { size: 22, weight: "bold" }),
        color: "red",
        confirm: "Bu makine KAPATILACAK. Emin misiniz?",
        getCommand: (a) =>
          isWindows(a) ? 'shutdown /s /t 5 /c "Kovan tarafından kapatılıyor"' : "sudo shutdown -h +0",
      },
      {
        id: "restart",
        label: "Yeniden Başlat",
        desc: "Makineyi yeniden başlat",
        icon: React.createElement(ArrowsClockwiseIcon, { size: 22, weight: "bold" }),
        color: "amber",
        confirm: "Bu makine YENİDEN BAŞLATILACAK. Emin misiniz?",
        getCommand: (a) =>
          isWindows(a) ? 'shutdown /r /t 5 /c "Kovan tarafından yeniden başlatılıyor"' : "sudo reboot",
      },
      {
        id: "lock",
        label: "Ekranı Kilitle",
        desc: "Oturumu kilitle",
        icon: React.createElement(LockIcon, { size: 22, weight: "bold" }),
        color: "blue",
        getCommand: (a) =>
          isWindows(a) ? "rundll32.exe user32.dll,LockWorkStation" : "loginctl lock-session",
      },
    ],
  },
  {
    category: "Sistem Bilgisi",
    icon: React.createElement(InfoIcon, { size: 14, weight: "bold" }),
    items: [
      {
        id: "sysinfo",
        label: "Sistem Bilgisi",
        desc: "OS ve donanım detayları",
        icon: React.createElement(InfoIcon, { size: 22, weight: "bold" }),
        color: "blue",
        getCommand: (a) =>
          isWindows(a)
            ? 'systeminfo | findstr /B /C:"OS" /C:"System" /C:"Total Physical" /C:"Available Physical" /C:"Processor"'
            : "uname -a && echo '---' && cat /etc/os-release 2>/dev/null | head -5 && echo '---' && uptime",
      },
      {
        id: "disk",
        label: "Disk Kullanımı",
        desc: "Disk alanı bilgisi",
        icon: React.createElement(HardDrivesIcon, { size: 22, weight: "bold" }),
        color: "green",
        getCommand: (a) =>
          isWindows(a) ? "wmic logicaldisk get size,freespace,caption" : "df -h",
      },
      {
        id: "network",
        label: "Ağ Bilgisi",
        desc: "IP ve arayüz bilgisi",
        icon: React.createElement(NetworkIcon, { size: 22, weight: "bold" }),
        color: "blue",
        getCommand: (a) =>
          isWindows(a) ? "ipconfig" : "ip addr show 2>/dev/null || ifconfig",
      },
      {
        id: "processes",
        label: "İşlemler",
        desc: "Çalışan süreçler",
        icon: React.createElement(ListBulletsIcon, { size: 22, weight: "bold" }),
        color: "green",
        getCommand: (a) =>
          isWindows(a)
            ? "tasklist /FO TABLE /NH | sort /R /+65 | head -20"
            : "ps aux --sort=-%mem | head -20",
      },
      {
        id: "cpu",
        label: "CPU Durumu",
        desc: "İşlemci kullanımı",
        icon: React.createElement(CpuIcon, { size: 22, weight: "bold" }),
        color: "amber",
        getCommand: (a) =>
          isWindows(a) ? "wmic cpu get loadpercentage" : "top -bn1 | head -5",
      },
      {
        id: "memory",
        label: "RAM Durumu",
        desc: "Bellek kullanımı",
        icon: React.createElement(MemoryIcon, { size: 22, weight: "bold" }),
        color: "blue",
        getCommand: (a) =>
          isWindows(a)
            ? "wmic OS get FreePhysicalMemory,TotalVisibleMemorySize /value"
            : "free -h",
      },
    ],
  },
  {
    category: "Ağ İşlemleri",
    icon: React.createElement(GlobeSimpleIcon, { size: 14, weight: "bold" }),
    items: [
      {
        id: "connections",
        label: "Aktif Bağlantılar",
        desc: "Açık TCP/UDP bağlantıları",
        icon: React.createElement(GlobeSimpleIcon, { size: 22, weight: "bold" }),
        color: "green",
        getCommand: (a) =>
          isWindows(a)
            ? "netstat -an | findstr ESTABLISHED"
            : "ss -tunapl 2>/dev/null | head -30 || netstat -tunapl | head -30",
      },
      {
        id: "ping",
        label: "İnternet Testi",
        desc: "Google DNS'e ping at",
        icon: React.createElement(WifiHighIcon, { size: 22, weight: "bold" }),
        color: "blue",
        getCommand: (a) =>
          isWindows(a) ? "ping -n 4 8.8.8.8" : "ping -c 4 8.8.8.8",
      },
    ],
  },
];
