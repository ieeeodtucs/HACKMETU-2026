package tr.org.lider.services;

import java.util.Date;
import java.util.List;
import java.util.Optional;

import javax.annotation.PostConstruct;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import tr.org.lider.entities.OperationType;
import tr.org.lider.entities.ScriptTemplate;
import tr.org.lider.entities.ScriptType;
import tr.org.lider.repositories.ScriptRepository;

@Service
public class ScriptService {
	

	@Autowired
	private ScriptRepository scriptRepository;
	
	@Autowired
	private OperationLogService operationLogService;
	
	@PostConstruct
	private void init() {
		if (scriptRepository.count() == 0) {
			ScriptType  scriptType = ScriptType.getType(1);
			String label = "Dosya Oluştur";
			String contents = "#!/bin/bash\n" + 
					"touch /tmp/test.txt";
			scriptRepository.save(new ScriptTemplate(scriptType, label, contents, new Date(), null, false));
		}
	}

	public Optional<ScriptTemplate> find(Long id){
		return scriptRepository.findById(id);
	}
	
	public List<ScriptTemplate> listAll(){
		return scriptRepository.findAllByDeleted(false);
	}
	
	public Page<ScriptTemplate> list(int pageNumber, int pageSize){
		PageRequest pageable = PageRequest.of(pageNumber - 1, pageSize);
		return scriptRepository.findByDeletedOrderByCreateDateDesc(pageable, false);
	}

	public ScriptTemplate add(ScriptTemplate script) {
		script.setDeleted(false);
		ScriptTemplate savedScript = scriptRepository.save(script);
		try {
			operationLogService.saveOperationLog(OperationType.CREATE, "Created script.", script.getContents().getBytes());
		} catch (Exception e) {
			e.printStackTrace();
		}
		return savedScript;
	}

	public ScriptTemplate delete(Long id) {
		ScriptTemplate existingScript = scriptRepository.findOne(id);
		existingScript.setDeleted(true);
		ScriptTemplate savedScript = scriptRepository.save(existingScript);
		try {
			operationLogService.saveOperationLog(OperationType.DELETE, "Deleted script", existingScript.getContents().getBytes());
		} catch (Exception e) {
			e.printStackTrace();
		}
		return savedScript;
	}
	
	public ScriptTemplate update(ScriptTemplate script) {
		script.setModifyDate(new Date());
		script.setDeleted(false);
		ScriptTemplate savedScript = scriptRepository.save(script);
		try {
			operationLogService.saveOperationLog(OperationType.UPDATE, "Updated script.", script.getContents().getBytes());
		}catch (Exception e) {
			e.printStackTrace();
		}
		return savedScript;
	}
}