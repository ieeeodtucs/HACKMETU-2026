package tr.org.lider.services;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import tr.org.lider.entities.RdpClient;
import tr.org.lider.repositories.RdpClientRepository;
import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

@Service
public class RdpClientService {

    @Autowired
    RdpClientRepository rdpClientRepository;

    public List<RdpClient> getSavedRdpClientList() {
        return rdpClientRepository.findAll();
    }

    public Page<RdpClient> getSavedRdpClientPage(int page, int size) {
        page = page - 1;
        Pageable pageable = PageRequest.of(page, size);
        return rdpClientRepository.findAll(pageable);
    }

    public RdpClient getSavedRdpClientById(long id) {
        return rdpClientRepository.findOne(id);
    }

    public RdpClient getSavedRdpClientByHost(String host) {
        return rdpClientRepository.findByHost(host);
    }

    public RdpClient getSavedRdpClientByUsername(String username) {
        return rdpClientRepository.findByUsername(username);
    }

    public RdpClient getSavedRdpClientByHostAndUsername(String host, String username) {
        return rdpClientRepository.findByHostAndUsername(host, username);
    }

    public RdpClient saveRdpClient(String host, String username, String hostname, String description) {
        return rdpClientRepository.save(new RdpClient(host, username, hostname, description));
    }

    public RdpClient updateSavedRdpClient(Long id, String host, String username, String hostname, String description) {
    	RdpClient rdpClient = rdpClientRepository.findOne(id);
        rdpClient.setHost(host);
        rdpClient.setUsername(username);
        rdpClient.setHostname(hostname);
        rdpClient.setDescription(description);
        return rdpClientRepository.save(rdpClient);
    }

    public Boolean deleteSavedRdpClient(Long id) {
        RdpClient rdpClient = rdpClientRepository.findOne(id);
        rdpClientRepository.delete(rdpClient);
        return true;
    }

    public Boolean deleteAllSavedRdpClient() {
        rdpClientRepository.deleteAll();
        return true;
    }

}
