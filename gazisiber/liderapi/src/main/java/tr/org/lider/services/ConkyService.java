package tr.org.lider.services;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import javax.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.web.bind.annotation.PathVariable;

import tr.org.lider.entities.ConkyTemplate;
import tr.org.lider.entities.OperationType;
import tr.org.lider.repositories.ConkyRepository;

@Service
public class ConkyService {

	@Autowired
	private ConkyRepository conkyRepository;
	
	@Autowired
	private OperationLogService operationLogService;
	
	@PostConstruct
	private void init() {
		if (conkyRepository.count() == 0) {
			String label = "Bilgisayar Bilgisi";
			String contents = "conky.text = [[\n" + 
					"${font sans-serif:bold:size=10}Sistem ${hr 2}\n" + 
					"${font sans-serif:normal:size=8}$sysname $kernel $alignr $machine\n" + 
					"Bilgisayar Adı:$alignr$nodename\n" + 
					"Dosya Sistemi: $alignr${fs_type}\n" + 
					"\n" + 
					"${font sans-serif:bold:size=10}İşlemci ${hr 2}\n" + 
					"${font sans-serif:normal:size=8}${execi 1000 grep model /proc/cpuinfo | cut -d : -f2 | tail -1 | sed 's/\\s//'}\n" + 
					"${font sans-serif:normal:size=8}${cpugraph cpu1}\n" + 
					"İşlemci: ${cpu cpu1}% ${cpubar cpu1}\n" + 
					"\n" + 
					"${font sans-serif:bold:size=10}RAM ${hr 2}\n" + 
					"${font sans-serif:normal:size=8}RAM $alignc $mem / $memmax $alignr $memperc%\n" + 
					"$membar\n" + 
					"SWAP $alignc ${swap} / ${swapmax} $alignr ${swapperc}%\n" + 
					"${swapbar}\n" + 
					"\n" + 
					"${font sans-serif:bold:size=10}Disk Kullanımı ${hr 2}\n" + 
					"${font sans-serif:normal:size=8}/ $alignc ${fs_used /} / ${fs_size /} $alignr ${fs_used_perc /}%\n" + 
					"${fs_bar /}\n" + 
					"\n" + 
					"${font Ubuntu:bold:size=10}Ağ ${hr 2}\n" + 
					"${font sans-serif:normal:size=8}Yerel IP:${alignr}External IP:\n" + 
					"${execi 1000 ip a | grep inet | grep -vw lo | grep -v inet6 | cut -d \\/ -f1 | sed 's/[^0-9\\.]*//g'}  ${alignr}${execi 1000  wget -q -O- http://ipecho.net/plain; echo}\n" + 
					"]];";
			
			String settings = "conky.config = {\n" + 
					"	update_interval = 1,\n" + 
					"	cpu_avg_samples = 2,\n" + 
					"	net_avg_samples = 2,\n" + 
					"	out_to_console = false,\n" + 
					"	override_utf8_locale = true,\n" + 
					"	double_buffer = true,\n" + 
					"	no_buffers = true,\n" + 
					"	text_buffer_size = 32768,\n" + 
					"	imlib_cache_size = 0,\n" + 
					"	own_window = true,\n" + 
					"	own_window_type = 'normal',\n" + 
					"	own_window_argb_visual = true,\n" + 
					"	own_window_argb_value = 50,\n" + 
					"	own_window_hints = 'undecorated,below,sticky,skip_taskbar,skip_pager',\n" + 
					"	border_inner_margin = 5,\n" + 
					"	border_outer_margin = 0,\n" + 
					"	xinerama_head = 1,\n" + 
					"	alignment = 'bottom_right',\n" + 
					"	gap_x = 0,\n" + 
					"	gap_y = 33,\n" + 
					"	draw_shades = false,\n" + 
					"	draw_outline = false,\n" + 
					"	draw_borders = false,\n" + 
					"	draw_graph_borders = false,\n" + 
					"	use_xft = true,\n" + 
					"	font = 'Ubuntu Mono:size=12',\n" + 
					"	xftalpha = 0.8,\n" + 
					"	uppercase = false,\n" + 
					"	default_color = 'white',\n" + 
					"	own_window_colour = '#000000',\n" + 
					"	minimum_width = 300, minimum_height = 0,\n" + 
					"	alignment = 'top_right',\n" + 
					"};\n"; 
					
			conkyRepository.save(new ConkyTemplate(label, contents, settings, new Date(), null, false));
		}
	}

	public Page<ConkyTemplate> list(int pageNumber, int pageSize){
		PageRequest pageable = PageRequest.of(pageNumber - 1, pageSize);
		return conkyRepository.findByDeletedOrderByCreateDateDesc(pageable, false);
	}
	
	public List<ConkyTemplate> listAll(){
		return conkyRepository.findAllByDeleted(false);
	}

	public ConkyTemplate add(ConkyTemplate template) {
		template.setDeleted(false);
		ArrayList<String> conky = new ArrayList<String>();
		conky.add(template.getSettings());
		conky.add(template.getContents());
		ConkyTemplate savedTemplate = conkyRepository.save(template);
		try {
			operationLogService.saveOperationLog(OperationType.CREATE, "Created system monitoring definition", conky.toString().getBytes());
		} catch (Exception e) {
			e.printStackTrace();
		}
		return savedTemplate;
	}

	public ConkyTemplate delete(Long id) {
		ConkyTemplate existTemplate = conkyRepository.findOne(id);
		existTemplate.setDeleted(true);
		ArrayList<String> conky = new ArrayList<String>();
		conky.add(existTemplate.getSettings());
		conky.add(existTemplate.getContents());
		ConkyTemplate savedTemplate = conkyRepository.save(existTemplate);
		try {
			operationLogService.saveOperationLog(OperationType.DELETE, "Deleted system monitoring definition", conky.toString().getBytes());
		} catch (Exception e) {
			e.printStackTrace();
		}
		return savedTemplate;
	}
	
	public ConkyTemplate update(ConkyTemplate template) {
		template.setModifyDate(new Date());
		template.setDeleted(false);
		ArrayList<String> conky = new ArrayList<String>();
		conky.add(template.getSettings());
		conky.add(template.getContents());
		ConkyTemplate savedTemplate = conkyRepository.save(template);
		try {
			operationLogService.saveOperationLog(OperationType.UPDATE, "Updated system monitoring definition", conky.toString().getBytes());
		} catch (Exception e) {
			e.printStackTrace();
		}
		return savedTemplate;
	}
}