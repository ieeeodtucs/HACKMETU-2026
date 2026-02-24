import customtkinter as ctk
import requests
import threading
import time

ctk.set_appearance_mode("dark")  
ctk.set_default_color_theme("blue")

SERVER_URL = "http://127.0.0.1:8000"

class HacktekDashboard(ctk.CTk):
    def __init__(self):
        super().__init__()

        self.title("Nükleer HackTEK - Merkezi Yönetim Paneli")
        self.geometry("2400x1500")
        
        self.header = ctk.CTkLabel(self, text="NÜKLEER HACKTEK - MERKEZİ YÖNETİM PANELİ", 
                                   font=("Arial", 22, "bold"), text_color="#00FFFF")
        self.header.pack(pady=10)

        self.main_frame = ctk.CTkFrame(self, fg_color="transparent")
        self.main_frame.pack(fill="both", expand=True, padx=20, pady=10)

        self.left_frame = ctk.CTkScrollableFrame(self.main_frame, width=350)
        self.left_frame.pack(side="left", fill="y", padx=(0, 10))
        
        ctk.CTkLabel(self.left_frame, text="--- AĞDAKİ AJANLAR ---", font=("Arial", 16, "bold"), text_color="#FFD700").pack(pady=10)
        
        self.reload_btn = ctk.CTkButton(self.left_frame, text="🔄 Ağı Tara (Yenile)", 
                                        fg_color="#333333", hover_color="#555555",
                                        command=self.manual_reload)
        self.reload_btn.pack(pady=(0, 10), padx=10, fill="x")
        
        self.agent_buttons = {}
        # ...
        
        self.agent_buttons = {}
        self.selected_agent = None

        self.right_frame = ctk.CTkFrame(self.main_frame)
        self.right_frame.pack(side="right", fill="both", expand=True)

        self.detail_title = ctk.CTkLabel(self.right_frame, text="Lütfen listeden bir ajan seçin", font=("Arial", 20, "bold"), text_color="gray")
        self.detail_title.pack(pady=30)

        self.cpu_label = ctk.CTkLabel(self.right_frame, text="CPU: %0", font=("Arial", 18))
        self.cpu_label.pack(anchor="w", padx=40, pady=10)
        
        self.ram_label = ctk.CTkLabel(self.right_frame, text="RAM: %0", font=("Arial", 18))
        self.ram_label.pack(anchor="w", padx=40, pady=10)

        ctk.CTkLabel(self.right_frame, text="Kritik İhlal Geçmişi (Son Olaylar):", font=("Arial", 16, "bold"), text_color="#FFD700").pack(anchor="w", padx=40, pady=(30, 5))
        
        self.alarm_box = ctk.CTkTextbox(self.right_frame, height=750, font=("Courier", 14))
        self.alarm_box.pack(fill="x", padx=40, pady=(0, 20))

        self.stats_frame = ctk.CTkFrame(self.right_frame, fg_color="#1a1a1a", border_width=1, border_color="#333333")
        self.stats_frame.pack(fill="x", padx=40, pady=(10, 20))

        self.data_info_label = ctk.CTkLabel(self.stats_frame, 
                                            text="Gelen Veri: 0.00 KB | Sıkıştırılmış: 0.00 KB", 
                                            font=("Arial", 14))
        self.data_info_label.pack(side="left", padx=30, pady=15)

        self.saving_label = ctk.CTkLabel(self.stats_frame, 
                                         text="TOPLAM AĞ TASARRUFU: %0.0", 
                                         font=("Arial", 16, "bold"), text_color="#00FF00")
        self.saving_label.pack(side="right", padx=30, pady=15)
        self.status_bar = ctk.CTkLabel(self, text="Durum: Sunucuya bağlanılıyor...", text_color="gray")
        self.status_bar.pack(side="bottom", pady=5)

        self.running = True
        self.thread = threading.Thread(target=self.fetch_data_loop, daemon=True)
        self.thread.start()

    def manual_reload(self):
        """Kullanıcı butona bastığında arayüzü temizler ve tarama başlatır"""
        self.reload_btn.configure(text="⏳ Taranıyor...")
        
        for btn in self.agent_buttons.values():
            btn.destroy()
        self.agent_buttons.clear()
        
        threading.Thread(target=self._force_fetch, daemon=True).start()

    def _force_fetch(self):
        """Sunucudan ajanları anında çeker"""
        try:
            resp = requests.get(f"{SERVER_URL}/stats", timeout=2)
            if resp.status_code == 200:
                data = resp.json()
                ajanlar = data.get('aktif_ajanlar', {})
                zamanlar = data.get('ajan_zaman_damgasi', {})
                self.after(0, lambda a=ajanlar, z=zamanlar: self.update_agent_list(a, z))
        except Exception:
            pass 
        finally:
            
            time.sleep(0.5) 
            self.after(0, lambda: self.reload_btn.configure(text=" Ağı Tara (Yenile)"))
    
    def select_agent(self, agent_id):
        self.selected_agent = agent_id
        self.detail_title.configure(text=f"SEÇİLİ AJAN: {agent_id.upper()}", text_color="#00FFFF")
        self.cpu_label.configure(text="CPU: Veri çekiliyor...")
        self.ram_label.configure(text="RAM: Veri çekiliyor...")
        self.alarm_box.delete("0.0", "end")
        self.alarm_box.insert("end", "Kayıtlar aranıyor...\n")

    def update_agent_list(self, ajanlar, zamanlar=None):
        if zamanlar is None: zamanlar = {}
        for cihaz_id, durum in ajanlar.items():
            renk = "green" if durum == "online" else "red"
            durum_metni = "ONLINE" if durum == "online" else "OFFLINE"
            saat = zamanlar.get(cihaz_id, "--:--:--")
            buton_metni = f"{cihaz_id}\n[{durum_metni}] {saat}"

            if cihaz_id not in self.agent_buttons:
                btn = ctk.CTkButton(self.left_frame, text=buton_metni, fg_color="transparent", 
                                    border_width=2, border_color=renk, text_color="white",
                                    command=lambda a=cihaz_id: self.select_agent(a))
                btn.pack(pady=5, padx=10, fill="x")
                self.agent_buttons[cihaz_id] = btn
            else:
                self.agent_buttons[cihaz_id].configure(border_color=renk, text=buton_metni)

    def fetch_data_loop(self):
        while self.running:
            try:
                resp = requests.get(f"{SERVER_URL}/stats", timeout=2)
                if resp.status_code == 200:
                    data = resp.json()
                    ajanlar = data.get('aktif_ajanlar', {})
                    zamanlar = data.get('ajan_zaman_damgasi', {})
                    self.after(0, lambda a=ajanlar, z=zamanlar: self.update_agent_list(a, z))
                    self.after(0, lambda: self.status_bar.configure(text="Durum: Sunucuya bağlı", text_color="green"))
                
                if self.selected_agent:
                    agent_resp = requests.get(f"{SERVER_URL}/api/agent/{self.selected_agent}", timeout=2)
                    if agent_resp.status_code == 200:
                        agent_data = agent_resp.json()

                        cpu = agent_data.get('cpu', 0)
                        ram = agent_data.get('ram', 0)
                        olaylar = agent_data.get('olaylar', [])
                        
                        ori_kb = agent_data.get('ori_byte', 0) / 1024
                        sik_kb = agent_data.get('sik_byte', 0) / 1024
                        tasarruf_yuzde = ((ori_kb - sik_kb) / ori_kb * 100) if ori_kb > 0 else 0

                        self.after(0, lambda c=cpu: self.cpu_label.configure(text=f"İşlemci (CPU): %{c:.1f}"))
                        self.after(0, lambda r=ram: self.ram_label.configure(text=f"Bellek (RAM): %{r:.1f}"))

                        self.after(0, lambda o=ori_kb, s=sik_kb: self.data_info_label.configure(
                            text=f"Gelen Veri: {o:.2f} KB | Sıkıştırılmış: {s:.2f} KB"))
                        self.after(0, lambda t=tasarruf_yuzde: self.saving_label.configure(
                            text=f"TOPLAM AĞ TASARRUFU: %{t:.1f}"))

                        def update_alarms(olay_listesi):
                            self.alarm_box.delete("0.0", "end")
                            if not olay_listesi:
                                self.alarm_box.insert("end", "[ TEMİZ ] - Kritik olay tespit edilmedi.\n")
                                self.alarm_box.configure(text_color="#00FF00")
                            else:
                                self.alarm_box.configure(text_color="#FF4444")
                                for olay in olay_listesi:
                                    ham_zaman = str(olay.get("zaman", ""))
                                    saat = ham_zaman.split("T")[1][:8] if "T" in ham_zaman else ham_zaman
                                    mesaj = str(olay.get("tip", "")).upper()
                                    self.alarm_box.insert("end", f"[{saat}] - {mesaj}\n")

                        self.after(0, update_alarms, olaylar)

            except Exception as e:
                self.after(0, lambda: self.status_bar.configure(text="Durum: Sunucu Hatası!", text_color="red"))
            
            time.sleep(1)

if __name__ == "__main__":
    app = HacktekDashboard()
    app.mainloop()
