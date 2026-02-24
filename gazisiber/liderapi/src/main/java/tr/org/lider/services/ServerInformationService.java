package tr.org.lider.services;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import tr.org.lider.entities.ServerInformationImpl;

import tr.org.lider.repositories.ServerInformationRepository;


@Service
public class ServerInformationService {
	
	@Autowired
	private ServerInformationRepository serverInformationRepository;
	
	public List<ServerInformationImpl> findById(Long id){
		return  serverInformationRepository.findByServerId(id);
	}


}
