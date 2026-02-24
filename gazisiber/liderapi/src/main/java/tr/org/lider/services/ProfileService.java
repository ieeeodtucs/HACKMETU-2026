package tr.org.lider.services;

import java.util.Date;
import java.util.List;
import java.util.Set;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import tr.org.lider.entities.OperationType;
import tr.org.lider.entities.PolicyImpl;
import tr.org.lider.entities.ProfileImpl;
import tr.org.lider.repositories.ProfileRepository;
import tr.org.lider.repositories.PolicyProfileRepository;

/**
 * Service for getting profile parameters from database and added, updated and deleted profile to database.
 * 
 * @author <a href="mailto:tuncay.colak@tubitak.gov.tr">Tuncay ÇOLAK</a>
 * 
 */

@Service
public class ProfileService {
	
	@Autowired
	private PolicyService policyService;

	@Autowired
	private ProfileRepository profileRepository;
	
	@Autowired
	private PolicyProfileRepository policyProfileRepository;
	
	@Autowired
	private OperationLogService operationLogService;
	
	public List<ProfileImpl> list(){
		return profileRepository.findAllByDeleted(false);
//		return profileRepository.findAll();
	}

	public ProfileImpl add(ProfileImpl profile) {
		ProfileImpl existProfile = profileRepository.save(profile);
		try {
			operationLogService.saveOperationLog(OperationType.CREATE, "Profil oluşturuldu.", existProfile.getProfileDataBlob(), null, null, existProfile.getId());
		} catch (Exception e) {
			e.printStackTrace();
		}
		return existProfile;
	}

	public ProfileImpl delete(Long id) {
		ProfileImpl existingProfile = findProfileByID(id);
		existingProfile.setDeleted(true);
		existingProfile.setModifyDate(new Date());
		List<PolicyImpl> policies = policyProfileRepository.findAllByProfileId(id);
		for (PolicyImpl policy : policies) {
			Set<ProfileImpl> profiles = policy.getProfiles();
			profiles.removeIf(p -> p.getId() == id);
			policy.setProfiles(profiles);
			policyService.update(policy);
		}
		try {
			operationLogService.saveOperationLog(OperationType.DELETE, "Profil silindi.", existingProfile.getProfileDataBlob(), null, null, existingProfile.getId());
		} catch (Exception e) {
			e.printStackTrace();
		}
		return profileRepository.save(existingProfile);
	}
	
	public ProfileImpl update(ProfileImpl profile) {
		ProfileImpl existProfile = findProfileByID(profile.getId());
		existProfile.setModifyDate(new Date());
		existProfile.setLabel(profile.getLabel());
		existProfile.setDescription(profile.getDescription());
		existProfile.setProfileData(profile.getProfileData());
		try {
			operationLogService.saveOperationLog(OperationType.UPDATE, "Profil güncellendi.", existProfile.getProfileDataBlob(), null, null, existProfile.getId());
		} catch (Exception e) {
			e.printStackTrace();
		}
		List<PolicyImpl> policies = policyProfileRepository.findAllByProfileId(profile.getId());
	
		for (PolicyImpl policy : policies) {
			policyService.updateVersion(policy);
		}
		return profileRepository.save(existProfile);
	}
	
	public ProfileImpl findProfileByID(Long id) {
		return profileRepository.findOne(id);
	}
	
	public List<ProfileImpl> findProfileByPluginID(Long pluginId) {
		return profileRepository.findByPluginId(pluginId);
	}
	
	public List<ProfileImpl> findProfileByPluginIDAndDeletedFalse(Long pluginId) {
		Boolean deleted = false;
		return profileRepository.findByPluginIdAndDeleted(pluginId, deleted);
	}
}