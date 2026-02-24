package tr.org.lider.services;

import java.util.List;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import tr.org.lider.entities.RegistrationTemplateImpl;
import tr.org.lider.models.RegistrationTemplateType;
import tr.org.lider.repositories.RegistrationTemplateRepository;

@Service
public class RegistrationTemplateService {

	@Autowired
	RegistrationTemplateRepository registrationTemplateRepository;

	public Optional<RegistrationTemplateImpl> findByID(Long id){
        return registrationTemplateRepository.findById(id);
	}
	
	public List<RegistrationTemplateImpl> findAll() {
        return registrationTemplateRepository.findAll();
	}
	
	public Page<RegistrationTemplateImpl> findAllByType(int pageNumber, int pageSize, RegistrationTemplateType templateType) {
        return registrationTemplateRepository.findAllByTemplateType(PageRequest.of(pageNumber -1, pageSize), templateType);
	}
	
	public List<RegistrationTemplateImpl> findAllOrderByUnitLength() {
        return registrationTemplateRepository.findAllOrderByUnitIdLength();
	}
	
	public Optional<RegistrationTemplateImpl> findRegistrationTemplateByID(Long id) {
        return registrationTemplateRepository.findById(id);
	}
	
	public RegistrationTemplateImpl save(RegistrationTemplateImpl template) {
		return registrationTemplateRepository.save(template);
	}
	
	public void delete(Long id) {
		registrationTemplateRepository.deleteById(id);
	}
}
